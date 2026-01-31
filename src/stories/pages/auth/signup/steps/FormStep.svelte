<script>
	import Button from "../../../../components/inputs/button/Button.svelte";
	import Input from "../../../../components/inputs/input/Input.svelte";

    let username = $state("");
    let password = $state("");
    let confirm_password = $state("");

    function onSubmit() {
        console.log(username, password)
    }

</script>
<div class="flex flex-col gap-4">
    <Input type="text" label="Username" bind:value={username} />
    <Input type="password" label="Password" bind:value={password} />
    <Input type="password" label="Confirm Password" bind:value={confirm_password} />
    <Button label="Sign In" onclick={onSubmit} />
</div>