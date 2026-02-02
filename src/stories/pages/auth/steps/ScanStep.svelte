<script lang="ts">
	import Button from "$components/actions/button/Button.svelte";
	import Qrcode from "$components/data-display/qrcode/Qrcode.svelte";

    interface Props {
        totpUri: string,
        onNext: () => {}
    }

    let { totpUri = "", onNext = () => {} } = $props();
</script>

<div class="p-4 flex flex-col gap-4">
    <Qrcode uri={totpUri} />
    <div class="flex flex-col gap-2">
        <p>You may also copy/paste the following code into your Two Factor Authentication app.</p>
        <a target="_blank" class="underline text-blue-800" href="https://duo.com/product/multi-factor-authentication-mfa/duo-mobile-app#download-duo-mobile">DUO Mobile is our recommended authentication app.</a>
        <p class="p-2 rounded bg-gray-200 text-nowrap overflow-y-scroll">
            { totpUri }
        </p>
    </div>

    <Button label="Next" onclick={onNext} />
</div>