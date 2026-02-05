<script lang="ts">
    import { authClient } from "$lib/client";
    import { onMount } from "svelte";
    
    // State management - using descriptive names
    let users = $state<any[]>([]);
    let totalUsers = $state(0);
    let totalPages = $state(0);
    let currentPage = $state(1);
    let isLoading = $state(true);
    let error = $state('');
    
    const pageSize = 10;
    
    // Separate function makes the code more readable and reusable
    async function loadUsers() {
        isLoading = true;
        error = '';
        
        try {
            const response = await authClient.admin.listUsers({
                query: {
                    limit: pageSize,
                    offset: (currentPage - 1) * pageSize
                }
            });
            
            // Always check for errors first
            if (response.error) {
                error = response.error.message || 'Failed to load users';
                users = [];
                totalUsers = 0;
                totalPages = 0;
                return;
            }
            
            // Now safely access the data
            users = response.data.users;
            totalUsers = response.data.total;
            totalPages = Math.ceil(totalUsers / pageSize);
            
        } catch (err) {
            // Catch any unexpected errors
            error = err instanceof Error ? err.message : 'An unexpected error occurred';
            users = [];
            totalUsers = 0;
            totalPages = 0;
        } finally {
            isLoading = false;
        }
    }
    
    // Load users when component mounts
    onMount(() => {
        loadUsers();
    });
    
    // Function to change pages - you'll want this for pagination
    function goToPage(page: number) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            loadUsers();
        }
    }
</script>

<div>
    {#if isLoading}
        <p>Loading users...</p>
    {:else if error}
        <p class="error">{error}</p>
    {:else}
        <div class="user-info">
            <p>Showing {users.length} of {totalUsers} users (Page {currentPage} of {totalPages})</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>
                        <input type="checkbox" aria-label="Select all users">
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Is Anonymous</th>
                    <th>Id</th>
                </tr>
            </thead>
            <tbody>
                {#each users as user (user.id)}
                    <tr>
                        <td>
                            <input type="checkbox" aria-label="Select {user.name || user.email}">
                        </td>
                        <td>{user.name || 'N/A'}</td>
                        <td>{user.email}</td>
                        <td>{user.role || 'user'}</td>
                        <td>{user.isAnonymous ? 'Yes' : 'No'}</td>
                        <td class="user-id">{user.id}</td>
                    </tr>
                {:else}
                    <tr>
                        <td colspan="6">No users found</td>
                    </tr>
                {/each}
            </tbody>
        </table>
        
        <!-- Simple pagination controls -->
        <div class="pagination">
            <button 
                onclick={() => goToPage(currentPage - 1)} 
                disabled={currentPage === 1}
            >
                Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button 
                onclick={() => goToPage(currentPage + 1)} 
                disabled={currentPage === totalPages}
            >
                Next
            </button>
        </div>
    {/if}
</div>

<style>
    .error {
        color: var(--color-error);
        padding: 1rem;
    }
    
    .user-info {
        margin-bottom: 1rem;
    }
    
    table {
        width: 100%;
        border-collapse: collapse;
    }
    
    th, td {
        text-align: left;
        padding: 0.5rem;
        border-bottom: 1px solid var(--color-outline-subtle);
    }
    
    .user-id {
        font-family: monospace;
        font-size: 0.875rem;
    }
    
    .pagination {
        margin-top: 1rem;
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>