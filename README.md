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

### 2. Start the application
Via your prefered command line interface, navigate to root the directory where the source code lives. Then run the following command to start the application.

```
docker compose up
```

Alternativly, sometimes you miay need to run this instead:
```
docker-compose up
```

### 3. Done!
Assuming everything worked as expected you should be able to access the application at [http://localhost:5173](http://localhost:5173)
