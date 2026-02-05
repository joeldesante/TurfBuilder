<script lang="ts">
	import Button from "$components/actions/button/Button.svelte";
	import Qrcode from "$components/data-display/qrcode/Qrcode.svelte";

    interface Props {
        totpUri: string,
        onNext: () => void
    }

    let { totpUri = "", onNext = () => {} }: Props = $props();
</script>

<div class="p-4 flex flex-col gap-4">
    <Qrcode uri={totpUri} />
    <div class="flex flex-col gap-2">
        <a target="_blank" class="underline text-primary" href="https://duo.com/product/multi-factor-authentication-mfa/duo-mobile-app#download-duo-mobile">DUO Mobile is our recommended authentication app.</a>
        <a href={totpUri} class="underline text-primary">Click here add this account to your phones authentication app.</a>
    </div>

    <Button label="Next" onclick={onNext} />
</div>