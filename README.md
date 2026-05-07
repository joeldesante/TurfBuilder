> [!IMPORTANT]  
> This website is for the developers of the canvassing software!
> If you are looking for the main website, please visit:
> https://turfbuilder.org

<img src="https://github.com/joeldesante/TurfBuilder/blob/fc4327063caae9f5c8a9bf545ced8101eb2c408a/static/logos/default-logo.svg" alt="Turf Builder" width="300px" height="auto" />
A free and open source canvassing tool for grassroots movements and campaigns.

--- 

[Check out our hosted documentation](http://docs.turfbuilder.org)

## Setting up your development enviorment

> [!NOTE]
> TurfBuilder requires a Postgres database with PostGIS enabled/installed to function.
> The easiest way to begin working on TurfBuilder is to build and run the application with Docker Compose.

### 1. Install Docker Desktop

To use Docker on your personal device, you will need to install [Docker Desktop](https://www.docker.com/products/docker-desktop/). You can download this software for free from the official website.

### 2. Set your environment variables

Find the `.env.example` file and rename it to `.env`. The defaults work out of the box for local development with Docker Compose.

### 3. Start the application

Via your preferred command line interface, navigate to the root directory where the source code lives. Then run the following command to start the application.

```
docker compose up --build frontend-dev
```

### 4. Initialize the database

Once the application is running, open [http://localhost:5173/setup](http://localhost:5173/setup) in your browser. This page will create all required database tables and seed data automatically.

### 5. Done!

Assuming everything worked as expected you should be able to access the application at [http://localhost:5173](http://localhost:5173)

## Key URLs

- Sign in: `/auth/signin`
- Sign up: `/auth/signup`
- Admin Dashboard: `/system`

---

## Credits

### Developers

> **Joel DeSante** - Engineer
>
> - Responsible for implementing the core functionality of the application.
>
> [**View LinkedIn**](https://linkedin.com/in/joeldesante)

> **Andrew Stitt** - Engineer
>
> - Contributed to the development of the application.
>
> [**View LinkedIn**](https://www.linkedin.com/in/andrewstitt) - [**View Portfolio**](https://andystitt.com/)

> **Leo Berman** - Engineer
>
> - Contributed to the development of the application.

### UI/UX

> **Chloe Atchue-Mamlet** - UI/UX
>
> - Responsible for making core decisions regarding the direction of the applications UI/UX
>
> [**View LinkedIn**](https://www.linkedin.com/in/chloeam/) - [**View Portfolio**](https://www.chloeam.com/)

### Artists

> **Hillary Hersh** - Logo Designer
>
> - Designed the TurfBuilder logos and favicons.

### Quality Assurance

> **Tealight** - QA
>
> - Managed the Quality Assurance and beta testing of the software during intial testing phases.

*...contributions have also been provided by many individuals who prefer not to be named... Thank you for your support!*

---

[![DigitalOcean Referral Badge](https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%203.svg)](https://www.digitalocean.com/?refcode=9bef31473a4c&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge)
