> [!IMPORTANT]  
> This website is for the developers of the canvassing software!
> If you are looking for the main website, please visit:
> https://turfbuilder.org

# Turf Builder
A free and open source canvassing tool for grassroots movements and campaigns.


## Setting up your development enviorment

> [!NOTE]
> TurfBuilder requires a Postgres database with PostGIS enabled/installed to function. 
> The easiest way to begin  working on TurfBuilder is to build and run the application with Docker Compose.

### 1. Install Docker Desktop
To use Docker on your personal device, you will need to install [Docker Desktop](https://www.docker.com/products/docker-desktop/). You can download this software for free from the official website.

### 2. Set your environment variables
Find the `.env.example` file and rename it to `.env`.
These environment variables will only impact the following database setup steps. Variables affecting your docker dev enviorment can be found in `docker-compose.yml`.

### 3. Locally install dependancies
Run `npm install` to locally install your dependancies.

### 4. Start the application
Via your prefered command line interface, navigate to root the directory where the source code lives. Then run the following command to start the application.

```
docker compose up --build
```

Alternativly, sometimes you miy need to run this instead:
```
docker-compose up --build
```

### 5. Setup your database

```
npm run db up
```

Assuming your `.env` is properly setup, meaning it has the `DATABASE_URL` value set. It should generate all of the tables required for the application along with the required seed data.

Make sure your database container is currently running.


### 5. Done!
Assuming everything worked as expected you should be able to access the application at [http://localhost:5173](http://localhost:5173)


## Updating the database

After installing, if you need to update the database schema, you may do soby running the 

```
npm run db up
```

command at anytime. It will automatically detect what changes have been made and then apply said changes to your database.


## Key URLs
- Sign in: `/auth/signin`
- Sign up: `/auth/signup`
- Admin Dashboard: `/system`


----

## Credits

### Developers
> **Joel DeSante** - Engineer
> - Responsible for implementing the core functionality of the application.
>
> [**View LinkedIn**](https://linkedin.com/in/joeldesante)

> **Andrew Stitt** - Engineer
> - Contributed to the development of the application.
>
> [**View LinkedIn**](https://www.linkedin.com/in/andrewstitt) - [**View Portfolio**](https://andystitt.com/)

### UI/UX
> **Chloe Atchue-Mamlet** - UI/UX
> - Responsible for making core decisions regarding the direction of the applications UI/UX 
>
> [**View LinkedIn**](https://www.linkedin.com/in/chloeam/) - [**View Portfolio**](https://www.chloeam.com/)

### Artists

> **Hillary Hersh** - Logo Designer
> - Designed the TurfBuilder logos and favicons.

### Quality Assurance
> **Tealight** - QA
> - Managed the Quality Assurance and beta testing of the software during intial testing phases.




