<script lang="ts">
	import Button from "$components/actions/button/Button.svelte";
	import Pin from "$components/data-inputs/pin/Pin.svelte";
	import { authClient } from "$lib/client";

    interface Props {
        onVerified: () => void
        onBack: () => void
    }

    let { onVerified = () => {}, onBack = () => {} }: Props = $props();

    async function attemptVerification(pin: string) {

        const { error } = await authClient.twoFactor.verifyTotp({
            code: pin
        });

        if(error) {
            console.error(error.message)
            return;
        }

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