<script lang="ts">
	import Button from "../../../../components/inputs/button/Button.svelte";
	import Pin from "../../../../components/inputs/pin/Pin.svelte";

    interface Props {
        onVerified: () => void
        onBack: () => void
    }

    let { onVerified = () => {}, onBack = () => {} } = $props();

    function attemptVerification(pin: string) {
        onVerified();
    }

</script>

<div>
    <h1>Enter your one time passcode</h1>
    <div>
        <Pin length={6} onPinEntered={(pin: string) => { attemptVerification(pin) }} />
    </div>
    <Button label="Back" onclick={onBack} />
</div>