<script>
    let { children } = $props();
</script>

<div class="wrapper">
    <aside>
        <ul>
            <li>
                <a href="/admin/">Dashboard</a>
            </li>
            <li>
                <span>Turf</span>
                <ul>
                    <li>
                        <a href="/admin/turfs">Overview</a>
                    </li>
                    <li>
                        <a href="/admin/turfs/cut">Cut Turf</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>People</span>
                <ul>
                    <li>
                        <a href="/admin/users">Accounts</a>
                    </li>
                    <li>
                        <a href="/admin/users/unverified">Unverified Accounts</a>
                    </li>
                    <li>
                        <a href="/admin/users/verified">Verified Accounts</a>
                    </li>
                    <li>
                        <a href="/admin/users/admins">Admins</a>
                    </li>
                    <li>
                        <a href="/admin/users/suspects">Suspicious Activity</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>Data</span>
                <ul>
                    <li>
                        <a href="/admin/data/locations">Locations</a>
                    </li>
                </ul>
            </li>
            <li>
                <span>Utilities</span>
                <ul>
                    <li>
                        <a href="/admin/utils/notify">Send Notification</a>
                    </li>
                    <li>
                        <a href="/admin/utils/lockdown">Lockdown</a>   <!-- In the event that the data is being activly poisoned and the admins want to disable all new incoming data temporarily -->
                    </li>
                </ul>
            </li>
        </ul>
    </aside>
    <main>
        <div>
            <div class="header">
                <span>Dashboard</span>
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