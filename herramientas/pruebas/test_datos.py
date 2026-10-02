"""Pruebas del ETL. Se ejecutan con:  python -m unittest discover -s herramientas/pruebas -v
Comprueban lo que puede romperse en silencio (ver docs/superpowers/specs, sección 9)."""
import json
import os
import re
import sys
import unicodedata
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(RAIZ, "data")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import rab_comun as C


def leer(rel):
    with open(os.path.join(DATA, rel), encoding="utf-8") as fh:
        return json.load(fh)


class Pruebas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cat = leer("catalogo.json")
        cls.zonas = leer("zonas.json")
        cls.bio = leer("tablas/biodiversidad.json")
        cls.pred_txt = open(os.path.join(DATA, "tablas/predios.json"), encoding="utf-8").read()

    def test_01_sin_mojibake(self):
        malas = []
        for root, _, files in os.walk(DATA):
            for f in files:
                if f.endswith((".json", ".geojson")):
                    txt = open(os.path.join(root, f), encoding="utf-8").read()
                    if C.hay_mojibake(txt) or "�" in txt:
                        malas.append(os.path.relpath(os.path.join(root, f), DATA))
        self.assertEqual(malas, [], f"Texto con codificación corrupta: {malas}")

    def test_02_areas_por_zona_cuadran_con_la_reserva(self):
        total = self.zonas["reserva"]["area_ha"]
        suma = sum(z["area_ha"] for z in self.zonas["zonas"])
        self.assertLess(abs(suma - total) / total, 0.01)
        for k, m in self.zonas["metricas"].items():
            cob = sum(c["ha"] for c in m["cobertura"])
            self.assertLess(abs(cob - m["area_ha"]) / m["area_ha"], 0.01, f"cobertura de {k}")

    def test_03_predios_sin_datos_personales(self):
        t = unicodedata.normalize("NFKD", self.pred_txt).encode("ascii", "ignore").decode().lower()
        for prohibido in ("propietario", "matricula", "cod_catastral", "cedula", "no. matr"):
            self.assertNotIn(prohibido, t)
        self.assertNotRegex(t, r"\b1754100030\d{6,}\b", "parece un código catastral")

    def test_04_catalogo_integro(self):
        declaradas = {c["archivo"] for c in self.cat["capas"]}
        for a in declaradas:
            self.assertTrue(os.path.isfile(os.path.join(DATA, a)), f"falta {a}")
        en_disco = set()
        for root, _, files in os.walk(os.path.join(DATA, "capas")):
            for f in files:
                en_disco.add(os.path.relpath(os.path.join(root, f), DATA).replace(os.sep, "/"))
        self.assertEqual(declaradas, en_disco)
        ids = [c["id"] for c in self.cat["capas"]]
        self.assertEqual(len(ids), len(set(ids)))
        for m in self.cat["modos"]:
            for cid in m["capas"]:
                self.assertIn(cid, ids, f"modo {m['id']} apunta a capa inexistente")

    def test_05_biodiversidad_no_pierde_registros(self):
        rep = leer("_reporte_preparacion.json")["biodiversidad"]
        entrada = sum(g["registros_salida"] for g in rep.values())
        self.assertEqual(entrada, len(self.bio["registros"]))
        self.assertEqual(self.zonas["metricas"]["toda"]["biodiversidad"]["registros"], len(self.bio["registros"]))
        marcados = sum(1 for r in self.bio["registros"] if r[9] in ("fuera", "sin_ubicacion"))
        b = self.zonas["metricas"]["toda"]["biodiversidad"]
        self.assertEqual(marcados, b["fuera_zonificacion"] + b["sin_ubicacion"])

    def test_06_cifras_por_zona_coinciden_con_los_registros(self):
        esp = self.bio["especies"]
        for k, m in self.zonas["metricas"].items():
            sel = self.bio["registros"] if k == "toda" else [r for r in self.bio["registros"] if r[9] == k]
            especies = {r[1] for r in sel if r[1]}
            self.assertEqual(m["biodiversidad"]["especies"], len(especies), k)
            self.assertEqual(m["biodiversidad"]["amenazadas"], sum(1 for e in especies if esp[e]["a"]), k)

    def test_07_presupuesto_de_peso(self):
        total = sum(c["bytes"] for c in self.cat["capas"])
        self.assertLess(total, 8 * 1024 * 1024)
        for c in self.cat["capas"]:
            self.assertLess(c["bytes"], 2 * 1024 * 1024, c["id"])

    def test_08_rutas_relativas(self):
        for c in self.cat["capas"]:
            self.assertFalse(c["archivo"].startswith(("/", "http", ".")), c["archivo"])
            self.assertNotIn("\\", c["archivo"])

    def test_09_riesgos_suman(self):
        t = self.zonas["metricas"]["toda"]
        self.assertEqual(sum(t["riesgos"].values()), t["riesgos_total"])
        for cap in self.cat["capas"]:
            if cap.get("riesgo"):
                self.assertEqual(t["riesgos"][cap["riesgo"]], cap["n"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
