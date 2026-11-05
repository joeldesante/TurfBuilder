# What it does
This python snippit takes a geojson file containing city bounds and parses open streetmaps for buildings inside of the bounds

# getting started
To use geo2csv make sure python is installed and install dependencies

1. ```pip install -r requirements.txt```
2. ```python main.py -f <yourgeojsonfilename>.geojson-i <column to search by> -l <value of column to search> -o <csvname>.csv```

Example of command: 
```python test.py -f Political_Divisions.geojson -i DIVISION_NUM -l 0505 -o 0505.csv```


This will create a CSV with the lattitude and longitude of every building inside the boundry that is Turfbuilder importable 

# Limitations
1. Currently there is no support for filtering down residential or building types.

2. Openstreetmaps API servers are busy quite often so script has to retry and still might fail. Please try again later if this does happen. 

3. Only geojsons with multiple entries have been tested. 



