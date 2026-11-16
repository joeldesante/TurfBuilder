-- Up Migration
-- Map layers an organization draws on its map: a named shape set with a color.
-- position 0 is the top of the stack and the layer is drawn last; larger
-- positions sit further down. Positions are not unique, so a reorder can write
-- them in any order without tripping over itself. Ties fall back to created_at.

CREATE TABLE public.map_layer (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	organization_id uuid NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	name text NOT NULL CHECK (btrim(name) <> ''),
	-- A CSS hex color such as #1d4ed8.
	color text NOT NULL CHECK (color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
	geojson jsonb NOT NULL CHECK (jsonb_typeof(geojson) = 'object'),
	-- The feature property drawn as each shape's label, or null for no labels.
	label_field text CHECK (label_field IS NULL OR label_field <> ''),
	position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX map_layer_org_position_idx
	ON public.map_layer (organization_id, position, created_at);

ALTER TABLE public.map_layer ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.map_layer FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON public.map_layer
	USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE public.map_layer;
