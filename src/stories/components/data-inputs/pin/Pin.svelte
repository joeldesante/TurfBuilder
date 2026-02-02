<script lang="ts">

    interface Props {
        length: number,
        onPinEntered: (pin: string) => void
    }

    let { length = 6, onPinEntered = (pin: string) => {} }: Props = $props();
    let pin = $state(new Array<string>(length).fill(""));
    let inputRefs = $state<HTMLInputElement[]>([]);
    let pinString = $derived(pin.join(''));

    $effect(() => {
        if(pinString.replaceAll(" ", "").length == length) {
            onPinEntered(pinString);
        }
    })

    function progressToNext(index: number, value: string) {

        if(value == '' && index > 0) {
            inputRefs[index - 1].focus();
            return;
        }

        if(index < (length - 1) && value != '' ) { 
            inputRefs[index + 1].focus();
            return; 
        }
        
    }
</script>

<div class="flex flex-row gap-2">
    {#each pin as _, index }
        <input type="text" bind:value={pin[index]} oninput={(event) => { progressToNext(index, event.currentTarget.value) }} bind:this={inputRefs[index]} inputmode="numeric" maxlength="1" class="border border-outline rounded h-10 p-1 text-center aspect-square text-lg font-medium">
    {/each}
</div>