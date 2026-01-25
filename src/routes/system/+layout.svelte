<script lang="ts">
	import type { ApplicationConfig } from "../../config";


    const { children, title, data } = $props<{ 
        children: () => any, 
        title?: string,
        data: {
            config: ApplicationConfig
        }
    }>();
</script>

<svelte:head>
  <title>{ title || 'Dashboard' } | { data.config.application_name }</title>
</svelte:head>

<div class="wrapper">
    <aside>
        <ul>
            <li>
                <a href="/system/">Dashboard</a>
            </li>
            <li>
                <span>Turf</span>
                <ul>
                    <li>
                        <a href="/system/turfs">Overview</a>
                    </li>
                    <li>
                        <a href="/system/turfs/cut">Cut Turf</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>People</span>
                <ul>
                    <li>
                        <a href="/system/users">Users</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>Data</span>
                <ul>
                    <li>
                        <a href="/system/data/locations">Locations</a>
                    </li>
                    <li>
                        <a href="/system/data/surveys">Surveys</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>Utilities</span>
                <ul>
                    <li>
                        <a href="/system/utils/notify">Send Notification</a>
                    </li>
                    <li>
                        <a href="/system/utils/lockdown">Lockdown</a>   <!-- In the event that the data is being activly poisoned and the admins want to disable all new incoming data temporarily -->
                    </li>
                </ul>
            </li>
        </ul>
    </aside>
    <main>
        <div>
            <div class="header">
                <span>{ title ?? 'Dashboard' }</span>
            </div>
            <div class="content">
                {@render children()}
            </div>
        </div>
    </main>
</div>

<style>
    .wrapper {
        display: grid;
        grid-template-columns: 250px auto;
    }

    aside {
        background-color: #EEE;
        height: 100vh;  
        padding-top: calc(1rem + 0.5rem);
        color: #000;
    }

    aside li {
        padding: 0.5rem 1rem;
        border-radius: 5px;
    }
    
    aside > ul > li > span {
        font-weight: 700;
        margin-top: 50px;
    }

    aside > ul > li > ul > li:hover {
        background-color: #BBB;
    }

    main {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
        background-color: #FFF;
    }

    main > div {
        padding: 10px 20px;
        border-radius: 10px;
        overflow: hidden;
        background-color: #FFF;
        min-height: 100%;
    }

    main div.header {
        font-size: 1.65rem;
        font-weight: bold;
        padding-top: 0.75rem;
    }

    main div.content {
        border-radius: 10px;
    }
</style>