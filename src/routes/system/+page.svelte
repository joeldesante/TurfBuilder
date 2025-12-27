<script lang="ts">
    import { authClient } from "$lib/client";
    const session = authClient.useSession();
</script>

<div>
    <p>
        Main portal with a grand overview of important data.
        includes links to certain pages like the list of users, list of turfs, maybe even a master location list
    </p>
</div>