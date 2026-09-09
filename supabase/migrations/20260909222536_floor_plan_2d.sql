-- HU-08 · RF-08.5 · HU-02 · RF-02.5 — plano 2D en imagen o PDF, descargable.
--
-- Un tipo de medio más para `property_media`. La política de Storage acota por la
-- primera carpeta (la propiedad), así que el nuevo tipo solo añade una subcarpeta
-- `floor_plan_2d/` y no toca permisos. El bucket ya admite imagen y PDF.
alter type public.property_media_kind add value if not exists 'floor_plan_2d';
