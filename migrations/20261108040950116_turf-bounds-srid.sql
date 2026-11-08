-- Up Migration
-- Turfs were saved with their GeoJSON polygon cast straight to geometry, which
-- leaves SRID 0. Checking whether a suggested door falls inside its turf then
-- fails ("Operation on mixed SRID geometries"), so volunteers could not add a
-- door to any turf. The polygons are longitude and latitude, so mark them 4326,
-- and type the column so a geometry without it is refused from now on.

UPDATE universe.turf SET bounds = ST_SetSRID(bounds, 4326) WHERE bounds IS NOT NULL AND ST_SRID(bounds) = 0;

ALTER TABLE universe.turf ALTER COLUMN bounds TYPE geometry(Geometry, 4326);

-- Down Migration

ALTER TABLE universe.turf ALTER COLUMN bounds TYPE geometry;
