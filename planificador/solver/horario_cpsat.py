#!/usr/bin/env python3
"""Distribución de clases con CP-SAT (OR-Tools).

Entrada (stdin, JSON) y salida (stdout, JSON). Lo llama el servidor (server.js).

Modelo, por semestre de cada sección:
- Cada sección tiene dos bloques en paralelo (pista 0 y pista 1) en sus días de clase.
- Días: si la sección tiene días fijos (confirmados), se usan esos. Si no, el solver elige
  el número de días indicado entre los días candidatos.
- Cada asignatura pendiente va en una pista y empieza en una semana; dura `dur` semanas
  (3 sesiones por semana en su pista). Dos asignaturas de la misma pista no se solapan.
- Cada sección tiene una sala fija (de capacidad suficiente). Una sala no puede tener dos clases
  a la misma hora en la misma semana. Un docente tampoco.
- Una sección no pasa de las semanas de su malla (si la malla las indica).
- Lo que ya está asignado a mano (o fijado en una fase anterior) es fijo.
- Objetivo: colocar todo primero y después terminar los semestres lo antes posible.
"""
import json
import sys

from ortools.sat.python import cp_model

HORIZONTE = 60  # semanas máximas consideradas


def main():
    data = json.load(sys.stdin)
    tiempo = float(data.get("tiempoSeg", 45))
    m = cp_model.CpModel()
    recursos = {}  # clave -> lista de intervalos

    def agregar(clave, intervalo):
        recursos.setdefault(clave, []).append(intervalo)

    # 1) Clases fijas: ocupan sus recursos en sus semanas (semanas reales, con feriados). Por recurso se unen los
    #    tramos que se tocan: dos clases seguidas en la misma sala o pista pueden compartir la semana del cambio.
    #    El margen (semanas) para sala y docente cubre el desfase con las fechas reales de las clases nuevas.
    tramos = {}
    for f in data.get("fijadas", []):
        ini, fin = f["desde"], f["hasta"]
        mg = int(f.get("margen", 0))
        for sl in f["slots"]:
            tramos.setdefault(("sec", f["secId"], sl["d"], sl["clave"]), []).append((ini, fin))
            if f.get("salaId"):
                tramos.setdefault(("sala", f["salaId"], sl["d"], sl["clave"]), []).append((max(1, ini - mg), fin + mg))
            if f.get("docente"):
                tramos.setdefault(("doc", f["docente"], sl["d"], sl["clave"]), []).append((max(1, ini - mg), fin + mg))
    for clave, lista in tramos.items():
        lista.sort()
        unidos = []
        for a, b in lista:
            if unidos and a <= unidos[-1][1] + 1:
                unidos[-1][1] = max(unidos[-1][1], b)
            else:
                unidos.append([a, b])
        for a, b in unidos:
            agregar(clave, m.NewFixedSizeIntervalVar(a, b - a + 1, "fija"))

    # 2) Días de cada sección.
    D = {}  # (sección, día) -> bool
    for sec in data["secciones"]:
        sid = sec["id"]
        for d in sec["diasCandidatos"]:
            b = m.NewBoolVar(f"d_{sid}_{d}")
            D[(sid, d)] = b
            if sec.get("diasFijos", True):
                m.Add(b == (1 if d in sec["diasFijos"] else 0))
        if not sec.get("diasFijos", True):
            m.Add(sum(D[(sid, d)] for d in sec["diasCandidatos"]) == sec["nDias"])

    # 2b) Cursos de una misma carrera que comparten sala: días complementarios (cada día, exactamente uno de los dos).
    grupos = {}
    for sec in data["secciones"]:
        if sec.get("complementario"):
            grupos.setdefault(sec["grupoSala"], []).append(sec)
    for par in grupos.values():
        if len(par) == 2:
            a, b = par
            for d in set(a["diasCandidatos"]) | set(b["diasCandidatos"]):
                va = D.get((a["id"], d), 0)
                vb = D.get((b["id"], d), 0)
                m.Add(va + vb == 1)

    # 3) Variables de las asignaturas pendientes.
    Y = {}  # grupo de sala (la sección, o la carrera si comparten sala) -> {sala: bool}
    grupo_de = {}
    salas_grupo = {}
    for sec in data["secciones"]:
        g = sec.get("grupoSala") or sec["id"]
        grupo_de[sec["id"]] = g
        # Si comparten sala, solo sirven las salas donde caben todos los cursos del grupo.
        salas_grupo[g] = [r for r in salas_grupo[g] if r in sec["salas"]] if g in salas_grupo else list(sec["salas"])
    for g, rs in salas_grupo.items():
        Y[g] = {r: m.NewBoolVar(f"y_{g}_{r}") for r in rs}
        if Y[g]:
            m.AddExactlyOne(Y[g].values())
    M = {}  # sección -> última semana
    P = {}  # (sección, asignatura) -> bool colocada
    X = {}  # (sección, asignatura, pista) -> bool
    S = {}  # (sección, asignatura) -> semana de inicio
    DUR = {}  # (sección, asignatura) -> semanas (entero o variable si depende del sábado)
    for sec in data["secciones"]:
        sid = sec["id"]
        ys = Y[grupo_de[sid]]
        M[sid] = m.NewIntVar(0, HORIZONTE, f"M_{sid}")
        limite = min(sec.get("limite") or HORIZONTE, HORIZONTE)
        for a in sec["asignaturas"]:
            cod = a["codigo"]
            dur = a["dur"]
            # Si la sección usa el sábado (4 horas), la asignatura dura menos semanas.
            dur_sa = a.get("durSa") or dur
            if dur_sa < dur and (sid, "Sa") in D:
                dv = m.NewIntVar(dur_sa, dur, f"dur_{sid}_{cod}")
                m.Add(dv == dur - (dur - dur_sa) * D[(sid, "Sa")])
                dur = dv
            DUR[(sid, cod)] = dur
            p = m.NewBoolVar(f"p_{sid}_{cod}")
            st = m.NewIntVar(1, HORIZONTE, f"s_{sid}_{cod}")
            P[(sid, cod)] = p
            S[(sid, cod)] = st
            fin_iv = m.NewIntVar(1, 2 * HORIZONTE + 1, f"e_{sid}_{cod}")  # fin del intervalo (inicio + duración)
            m.Add(fin_iv == st + dur)
            m.Add(st <= limite - dur + 1).OnlyEnforceIf(p)
            m.Add(M[sid] >= st + dur - 1).OnlyEnforceIf(p)
            xs = []
            for t in range(2):
                x = m.NewBoolVar(f"x_{sid}_{cod}_{t}")
                X[(sid, cod, t)] = x
                xs.append(x)
            m.Add(sum(xs) == p)
            for t, pista in enumerate(a["pistas"]):
                x = X[(sid, cod, t)]
                for sl in pista["slots"]:
                    dia = (sid, sl["d"])
                    if not sl["ok"] or dia not in D:
                        # Este día/bloque no sirve para esta asignatura en esta pista.
                        m.AddBoolOr([x.Not()] + ([D[dia].Not()] if dia in D else []))
                        continue
                    # Presencia: la asignatura está en la pista t y la sección usa ese día.
                    pres = m.NewBoolVar(f"pd_{sid}_{cod}_{t}_{sl['d']}")
                    m.AddBoolAnd([x, D[dia]]).OnlyEnforceIf(pres)
                    m.AddBoolOr([x.Not(), D[dia].Not(), pres])
                    iv_sec = m.NewOptionalIntervalVar(st, dur, fin_iv, pres, f"iv_{sid}_{cod}_{t}_{sl['d']}")
                    agregar(("sec", sid, sl["d"], sl["clave"]), iv_sec)
                    if a.get("docente"):
                        agregar(("doc", a["docente"], sl["d"], sl["clave"]), iv_sec)
                    for r in ([] if a.get("online") else ys):
                        pr = m.NewBoolVar(f"pr_{sid}_{cod}_{t}_{sl['d']}_{r}")
                        m.AddBoolAnd([pres, ys[r]]).OnlyEnforceIf(pr)
                        m.AddBoolOr([pres.Not(), ys[r].Not(), pr])
                        agregar(("sala", r, sl["d"], sl["clave"]), m.NewOptionalIntervalVar(st, dur, fin_iv, pr, f"ivs_{sid}_{cod}_{t}_{sl['d']}_{r}"))

    # 4) Sin solapes por recurso.
    for ivs in recursos.values():
        if len(ivs) > 1:
            m.AddNoOverlap(ivs)

    # 5) Objetivo: colocar todo primero; después terminar temprano.
    if data.get("minimizarSalas"):
        # Estimación: todas las asignaturas deben quedar colocadas; se minimiza cuántas salas distintas se usan.
        for p in P.values():
            m.Add(p == 1)
        usada = {}
        for _g, rs in Y.items():
            for r, v in rs.items():
                if r not in usada:
                    usada[r] = m.NewBoolVar(f"usada_{r}")
                m.AddImplication(v, usada[r])
        m.Minimize(sum(usada.values()) * 1000 + sum(M.values()))
    else:
        # El sábado se usa solo si hace falta: cada sección que lo usa cuesta más que alargar su semestre.
        sabados = [D[(s["id"], "Sa")] for s in data["secciones"] if s.get("evitarSabado") and (s["id"], "Sa") in D]
        # Reparto parejo: en cada jornada, la diferencia entre el día de lunes a viernes con más secciones
        # y el día con menos debe ser la menor posible (así las salas se llenan parejo toda la semana).
        desbalance = []
        for jor in sorted({s.get("jornada") for s in data["secciones"] if s.get("elige")}):
            secs = [s["id"] for s in data["secciones"] if s.get("jornada") == jor]
            cargas = []
            for d in ("Lu", "Ma", "Mi", "Ju", "Vi"):
                vs = [D[(sid, d)] for sid in secs if (sid, d) in D]
                if vs:
                    cargas.append(sum(vs))
            if len(cargas) > 1:
                hi = m.NewIntVar(0, len(secs), f"hi_{jor}")
                lo = m.NewIntVar(0, len(secs), f"lo_{jor}")
                for c in cargas:
                    m.Add(hi >= c)
                    m.Add(lo <= c)
                desbalance.append(hi - lo)
        # Desempate: si da lo mismo, se prefieren los días configurados en la jornada (p. ej. 1º año Ma-Ju-Sá).
        fuera = [D[(s["id"], d)] for s in data["secciones"] if s.get("elige") for d in s["diasCandidatos"]
                 if d not in (s.get("diasPreferidos") or []) and (s["id"], d) in D]
        # El curso con más horas de cada carrera debería tener el sábado (4 horas): pesa más que el patrón configurado.
        sin_sabado = [1 - D[(s['id'], 'Sa')] for s in data['secciones'] if s.get('prefiereSabado') and (s['id'], 'Sa') in D]
        # Pasar del cierre del periodo es lo más caro después de dejar asignaturas sin lugar (60 por hora que no cabe).
        # Se mide en horas por pista: hasta el cierre caben 9 h por semana (3 sesiones de 3 h) o 10 con sábado (4 h).
        exceso = []
        for s in data["secciones"]:
            if not s.get("cierre"):
                continue
            sid = s["id"]
            con_sa = D.get((sid, "Sa"), 0)
            for t in range(2):
                horas = sum(X[(sid, a["codigo"], t)] * int(a.get("horas") or 0) for a in s["asignaturas"])
                e = m.NewIntVar(0, 2000, f"exc_{sid}_{t}")
                m.Add(e >= horas - 9 * s["cierre"] - s["cierre"] * con_sa)
                exceso.append(e)
        m.Minimize(sum(M.values()) + 100 * sum(sabados) + 200 * sum(desbalance) + 5 * sum(fuera) + 50 * sum(sin_sabado) + 60 * sum(exceso) - 1000 * sum(P.values()))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = tiempo
    solver.parameters.num_workers = 8
    estado = solver.StatusName(solver.Solve(m))

    if estado not in ("OPTIMAL", "FEASIBLE"):
        print(json.dumps({"estado": estado, "asignaturas": [], "salas": {}, "dias": {}}))
        return

    salas = {}
    for sid, g in grupo_de.items():
        for r, v in Y[g].items():
            if solver.Value(v):
                salas[sid] = r
    dias = {}
    for sec in data["secciones"]:
        dias[sec["id"]] = [d for d in sec["diasCandidatos"] if solver.Value(D[(sec["id"], d)])]
    asignaturas = []
    for sec in data["secciones"]:
        for a in sec["asignaturas"]:
            key = (sec["id"], a["codigo"])
            colocada = bool(solver.Value(P[key]))
            pista = None
            if colocada:
                pista = next(t for t in (0, 1) if solver.Value(X[(key[0], key[1], t)]))
            asignaturas.append({
                "seccion": sec["id"],
                "codigo": a["codigo"],
                "colocada": colocada,
                "pista": pista,
                "desde": solver.Value(S[key]) if colocada else None,
                "dur": solver.Value(DUR[key]) if colocada else a["dur"],
            })
    print(json.dumps({"estado": estado, "asignaturas": asignaturas, "salas": salas, "dias": dias}))


if __name__ == "__main__":
    main()
