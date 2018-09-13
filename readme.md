## How to use
1. Make sure you have all the ACS variables you want specified in `variables.json`. 
2. Run `node index`.
3. The results will be dropped into `export.json`.

## ACS data
* Median household income in the past 12 months (in 2016 Inflation-adjusted dollars) (`B19013_001E`)
* Not Hispanic or Latino — White alone (`B03002_003E`)
* Industry by Class of Worker for the Civilian Employed Population 16 Years and Over: Total (`C24070_001E`)
* Industry by Occupation for the Civilian Employed Population 16 Years and Over: Manufacturing (`C24050_004E`)
* Industry by Class of Worker for the Civilian Employed Population 16 Years and Over: Agriculture, forestry, fishing and hunting, and mining (`C24070_002E`)

## Non-ACS data used
* County\_Rural\_Lookup.xslx: Uses Census 2010 data to classify a county as a certain percent urban and rural. More information: https://www.census.gov/newsroom/press-releases/2016/cb16-210.html