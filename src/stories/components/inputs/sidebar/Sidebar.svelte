<script lang="ts">

    interface Props {
        urls: string[]
    }

    let { urls }: Props = $props()
</script>

<div class="flex flex-col gap-2">
    {#each urls as url }
    <a href={url}>
        <div>
            HJGHKGKG
        </div>
    </a>
    {/each}
</div>