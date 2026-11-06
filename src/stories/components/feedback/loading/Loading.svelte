<script lang="ts">
	import LogoPaths from '$components/layout/fragments/logo/LogoPaths.svelte';

	interface Props {
		width?: number | string;
		color?: string;
		label?: string;
		/**
		 * Replaces the distortion and the sweeping wave with a light opacity pulse.
		 * Left unset it follows the operating system's reduced motion setting; true or false forces it.
		 */
		reducedMotion?: boolean;
	}

	const {
		width = 160,
		color = 'var(--primary)',
		label = 'Loading',
		reducedMotion
	}: Props = $props();

	const uid = $props.id();
	const lightColor = $derived(`color-mix(in srgb, ${color} 60%, white)`);
	const logoWidth = $derived(typeof width === 'number' ? `${width}px` : width);

	// One wave, travelling along x + y (exactly 45 degrees, top left to bottom right).
	//
	// - The warp is an SVG displacement filter. Its map is a diagonal gradient image whose green
	//   channel pushes pixels up by a little, so the logo swells where the wave passes.
	// - The map is slid to the right with SMIL (the feImage x attribute). The stripes run along
	//   x + y, so sliding by one period in x moves the wave along the diagonal and loops cleanly.
	// - The lighter green is a masked copy of the logo; the mask's gradient slides the same way.
	const PERIOD = 340; // length of one wave cycle, in x + y
	const DURATION = '1.5s';
	const LEAD = 129.2; // x + y of the wave's leading edge inside the gradient (offset .38)
	const REGION = { x: -4, y: -6, width: 151, height: 86 };
	const MAP_WIDTH = 620; // wide enough to cover the region while sliding one full period
	const MAP_X_END = -LEAD - REGION.y; // wave's leading edge starts at the top left corner
	const MAP_X_START = MAP_X_END - PERIOD;

	const mapImage = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_WIDTH}" height="${REGION.height}"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${PERIOD / 2}" y2="${PERIOD / 2}" spreadMethod="repeat"><stop offset="0" stop-color="rgb(128,128,128)"/><stop offset=".04" stop-color="rgb(128,128,128)"/><stop offset=".125" stop-color="rgb(128,166,128)"/><stop offset=".21" stop-color="rgb(128,205,128)"/><stop offset=".295" stop-color="rgb(128,166,128)"/><stop offset=".38" stop-color="rgb(128,128,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></linearGradient></defs><rect width="${MAP_WIDTH}" height="${REGION.height}" fill="url(#g)"/></svg>`;
	const mapHref = `data:image/svg+xml,${encodeURIComponent(mapImage)}`;
</script>

<div role="status" class="inline-block">
	<span class="sr-only">{label}</span>
	<svg
		class="loading-filter"
		class:reduced={reducedMotion === true}
		class:motion={reducedMotion === false}
		style="width: {logoWidth}; height: auto;"
		viewBox="0 0 142.71001 74.062668"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<defs>
			<filter
				id="{uid}-warp"
				filterUnits="userSpaceOnUse"
				x={REGION.x}
				y={REGION.y}
				width={REGION.width}
				height={REGION.height}
				color-interpolation-filters="sRGB"
			>
				<feImage
					href={mapHref}
					x={MAP_X_END}
					y={REGION.y}
					width={MAP_WIDTH}
					height={REGION.height}
					preserveAspectRatio="none"
					result="map"
				>
					<animate
						attributeName="x"
						from={MAP_X_START}
						to={MAP_X_END}
						dur={DURATION}
						repeatCount="indefinite"
					/>
				</feImage>
				<feDisplacementMap
					in="SourceGraphic"
					in2="map"
					scale="4"
					xChannelSelector="R"
					yChannelSelector="G"
				/>
			</filter>

			<linearGradient
				id="{uid}-glow"
				gradientUnits="userSpaceOnUse"
				x1="0"
				y1="0"
				x2={PERIOD / 2}
				y2={PERIOD / 2}
				spreadMethod="repeat"
			>
				<animateTransform
					attributeName="gradientTransform"
					type="translate"
					from="{-LEAD} 0"
					to="{PERIOD - LEAD} 0"
					dur={DURATION}
					repeatCount="indefinite"
				/>
				<stop offset="0" stop-color="white" stop-opacity="0" />
				<stop offset=".04" stop-color="white" stop-opacity="0" />
				<stop offset=".12" stop-color="white" stop-opacity=".6" />
				<stop offset=".21" stop-color="white" stop-opacity="1" />
				<stop offset=".28" stop-color="white" stop-opacity=".4" />
				<stop offset=".34" stop-color="white" stop-opacity=".7" />
				<stop offset=".38" stop-color="white" stop-opacity="0" />
				<stop offset="1" stop-color="white" stop-opacity="0" />
			</linearGradient>
			<mask id="{uid}-mask" maskUnits="userSpaceOnUse" x="-10" y="-10" width="170" height="100">
				<rect x="-10" y="-10" width="170" height="100" fill="url(#{uid}-glow)" />
			</mask>

			<g id="{uid}-logo"><LogoPaths /></g>
		</defs>

		<g class="warp" filter="url(#{uid}-warp)">
			<use href="#{uid}-logo" style="color: {color};" />
			<use class="glow" href="#{uid}-logo" style="color: {lightColor};" mask="url(#{uid}-mask)" />
		</g>
	</svg>
</div>

<style>
	.loading-filter {
		display: block;
		overflow: visible;
	}

	/* Reduced motion: no distortion and no sweeping wave. The logo stays put and only pulses
	   lightly in opacity, so it still reads as loading. SMIL ignores the media query, so the
	   filter and the glow are what we switch off. */
	.reduced .warp {
		filter: none;
		animation: loading-pulse 1.5s ease-in-out infinite;
	}

	.reduced .glow {
		display: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-filter:not(.motion) .warp {
			filter: none;
			animation: loading-pulse 1.5s ease-in-out infinite;
		}

		.loading-filter:not(.motion) .glow {
			display: none;
		}
	}

	@keyframes loading-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
