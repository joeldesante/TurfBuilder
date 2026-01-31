<script lang="ts">
    import QRCode from 'qrcode'

    const { uri }: { uri: string } = $props();
    let canvas: HTMLCanvasElement;

    $effect(() => {
        QRCode.toCanvas(canvas, uri);
    });
</script>

<div>
    <canvas bind:this={canvas}></canvas>
</div>