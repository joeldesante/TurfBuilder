import shapely
import geopandas as gpd
import pandas as pd
import osmnx
from pathlib import Path
import csv
import argparse
import logging
import sys
from shapely.geometry import box, Polygon
from shapely import LineString
import time
import requests

#TODO implement actual logging
logger = logging.basicConfig()
#max_area = 0.0004690623743734645
parser = argparse.ArgumentParser(
    prog="Turfbuilder geo2locations",
    description="CLI tool to take GEOJSON Boundries and finds locations inside to be canvased.",
)
#osmnx.settings.overpass_url = "https://overpass.private.coffee/api/interpreter"
#osmnx.settings.max_query_area_size= 625000000
osmnx.settings.timeout = 600
osmnx.settings.overpass_settings = '[out:json][timeout:600]{maxsize}'
#Todo
parser.add_argument('-f','--filename', help="geojson file to parse")
parser.add_argument('-i', '--index',help="set equal to column name to filter by")
parser.add_argument('-l', '--limit', help="set equal to the column value to extract")
parser.add_argument('-o', '--output', help="name of CSV file for Turfbuilder")
#parser.add_argument('-t' '--type', help="OSM Building types to be exported") #TODO implement this later into the OSM search
#from geodatasets import get_path

#source = "Political_Divisions.geojson"

features_csv = Path("2106.csv")

def load_geodata(geojsonfile, geodataindex="none"):
    #Creates geopandas df from file
    geodata = gpd.read_file(geojsonfile)
    #Sets CRS to popular format 
    geodata.set_crs("EPSG:4326")
    geodata.set_crs(epsg=4326)

    #For multi geometry files set index to enable filtering
    if geodataindex != "none":
        geodata.set_index(geodataindex)
    return geodata

 


def osm_search_from_polygon(polygon):
    max_attempts = 3
    attempts = 0
    last_exception = None

    while attempts < max_attempts:
        attempts += 1
        try:
            features = osmnx.features_from_polygon(polygon=polygon, tags={'building': True})
            print("Successfully got OSM features")
            return features
        except Exception as e:
            print(f"OSM features failed (attempt {attempts}/{max_attempts}): {e}")
            if attempts >= max_attempts:
                print("Issue with OSM API please rerun again/later")
                raise e
            time.sleep(3 * attempts)

             


def clean_features(features):
    #Filter NAN address numbers 
    filtered_features = features.dropna(subset=["addr:housenumber"])

    #Dictonary of collumns for Turfbuilder
    allowed = {"name": "", "address_line_1": "", "address_line_2": "",
           "city": "", "state_or_region": "", "postal_code": "",
           "country_code": "", "latitude": float('nan'), "longitude": float('nan')}

    #Adds columns to dataframe
    for new_col, value in allowed.items():
        filtered_features[new_col] = value

    for index, place in filtered_features.iterrows():
        
        point = place["geometry"].centroid
        house_num = str(place["addr:housenumber"])
        street = place["addr:street"]

        if pd.isna(street):
            filtered_features.loc[index, "address_line_1"] = house_num
            filtered_features.loc[index, "name"] = house_num
        else:
            filtered_features.loc[index, "address_line_1"] = house_num + " " + str(street)
            filtered_features.loc[index, "name"] = house_num + " " + str(street)

        filtered_features.loc[index, "latitude"]  = point.y  # y = lat
        filtered_features.loc[index, "longitude"] = point.x  # x = lon

        city = place["addr:city"]
        if not pd.isna(city):
            filtered_features.loc[index, "city"] = city
    #Drop undeeded columns
    filtered_features = filtered_features[list(allowed.keys())]

    return filtered_features

def get_series(geodata, limiter, index):
    #TODO verify series limiter is valid
    print(limiter)
    for series, row in geodata.iterrows():
        if row[index] == limiter: 
            print("Found limit")
            geometry = geodata.loc[series, "geometry"]
            return geometry
        else: 
             continue

def split_polygon(polygon: Polygon, max_area: float) -> list[Polygon]:
    pieces: list[Polygon] = [polygon]
    print(polygon.area)
    while any(piece.area > max_area for piece in pieces):
        for i, piece in enumerate(pieces):
            if piece.area > max_area:
                a, b, c, d = piece.bounds  # minx, miny, maxx, maxy

                # Try vertical split first (mid-x)
                mid_x = (a + c) / 2
                line = LineString([(mid_x, b - 1), (mid_x, d + 1)])
                split_collection = shapely.split(piece, line)

                # If vertical split produced no pieces, try horizontal (mid-y)
                if len(split_collection.geoms) == 0:
                    mid_y = (b + d) / 2
                    line = LineString([(a - 1, mid_y), (c + 1, mid_y)])
                    split_collection = shapely.split(piece, line)

                new_pieces = [
                    geom for geom in split_collection.geoms
                    if geom.geom_type == "Polygon" and geom.area > 0
                ]

                # Replace the old piece with the new ones
                pieces = pieces[:i] + new_pieces + pieces[i + 1:]
                break  # re-evaluate the while loop with the updated list

    return pieces


if __name__ =="__main__":

    #loads args and sets values
    args = parser.parse_args()
    print(args)
    geofile = args.filename
    geoindex = args.index
    outputfile = args.output
    limiter = args.limit
    #cheks if geofile exists
    if Path(geofile):
        print("Found GEODATA file")
    else: 
        sys.exit(1)
    geodata = load_geodata(geofile)

    if limiter: 
        geometry = get_series(geodata=geodata, limiter=limiter, index=geoindex)
    else: 
        #TODO FIND ONE GEOMETRY GEOFILE AND TEST SINGLE ENTRY LIMIT LARGE SIZE
        sys.exit(1)
        print("NO LIMITER")
    
    if geometry is None: 
        print("Geometry not found")
        sys.exit(1)


    features =osm_search_from_polygon(polygon=geometry)
    cleaned_featurs = clean_features(features=features)

    cleaned_featurs.to_csv(outputfile)
