<script lang="ts">
	import Button from "$components/actions/button/Button.svelte";
	import Qrcode from "$components/data-display/qrcode/Qrcode.svelte";

    interface Props {
        totpUri: string,
        onNext: () => {}
    }

    let { totpUri = "", onNext = () => {} } = $props();
</script>

<div>
    <Qrcode uri={totpUri} />
    <hr>
    <p>You may also paste the code into your Two Factor Authentication app.</p>
    <pre>
        { totpUri }
    </pre>

    <Button label="Next" onclick={onNext} />
</div>