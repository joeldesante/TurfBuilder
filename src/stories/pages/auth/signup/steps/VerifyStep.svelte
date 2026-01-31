<script lang="ts">
	import Pin from "../../../../components/inputs/pin/Pin.svelte";

    interface Props {
        onVerified: () => void
    }

    let { onVerified = () => {} } = $props();

    function attemptVerification(pin: string) {
        onVerified();
    }

</script>

<div>
    <h1>Enter your one time passcode</h1>
    <div>
        <Pin length={6} onPinEntered={(pin: string) => { attemptVerification(pin) }} />
    </div>
</div>