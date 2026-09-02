# HU-01 — Catálogo público de propiedades

Épica E1 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver un catálogo público de propiedades con fotos, ubicación y precio por fracción, para decidir si quiero invertir.

## Requisitos funcionales
- **RF-01.1** — El catálogo lista solo propiedades con visibilidad `Publicada` (HU-08); nunca `En borrador` ni `Inactiva`.
- **RF-01.2** — Cada tarjeta muestra foto principal, nombre, ubicación, precio por fracción y estado comercial (`Próximamente` / `Fracciones disponibles` / `Vendido`).
- **RF-01.3** — Filtros combinables por región, rango de precio y estado comercial con el vocabulario único de D-18 (`Próximamente` / `Fracciones disponibles` / `Vendido`), más el filtro derivado "admite lista de espera"; el filtrado es lógica pura en un composable.
- **RF-01.4** — La ficha resumida expone m², habitaciones, baños y estacionamientos, y enlaza al detalle (HU-02).
- **RF-01.5** — El acceso es público: la consulta usa una vista/política RLS de solo lectura para anónimos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-01.1** — Dado un conjunto de propiedades con distintos estados de visibilidad, cuando se aplica el composable de catálogo, entonces solo aparecen las `Publicada`.
- **CA-01.2** — Dado un filtro región + precio + estado, cuando se aplican en conjunto, entonces el resultado cumple los tres criterios a la vez.
- **CA-01.3** — Dado un filtro sin coincidencias, entonces se retorna lista vacía y la UI muestra el estado vacío traducido.

## Dependencias
- HU-08 (modelo y estados de propiedad) · HU-02 (destino del detalle).
