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

### 3. Start the application
Via your prefered command line interface, navigate to root the directory where the source code lives. Then run the following command to start the application.

```
docker compose up
```

Alternativly, sometimes you miay need to run this instead:
```
docker-compose up
```

### 4. Setup your database

First, run:
```
npm install
```

Then,
```
npx @better-auth/cli generate
```

Then, run:
```
npx @better-auth/cli migrate
```

Assuming your `.env` is properly setup, meaning it has the `DATABASE_URL` value set. It should generate the first set of tables required for the authentication component of this application.

#### Next,
We now need to set up the remainder of the schema.

While your docker containers are running, execute the command
```
npm run db:build
```
in your terminal.


### 5. Done!
Assuming everything worked as expected you should be able to access the application at [http://localhost:5173](http://localhost:5173)


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




