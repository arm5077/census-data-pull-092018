const request = require('request-promise-native'),
  fs = require('fs'),
  papaparse = require('papaparse'),
  variables = require('./variables.json');

async function init(){
  const queryString = variables.map((d) => d.id).reduce((a,b) => {
    return a + "," + b
  });

  result = await request(`https://api.census.gov/data/2016/acs/acs5?get=NAME,COUNTY,STATE,${queryString}&for=county:*&in=state:*`)
  result = JSON.parse(result);

  // Replace header with human-readable text
  result[0] = result[0].map(d => {
    const match = variables.find(f => d === f.id);
    if (match) {
      return match.simpleName;
    }
    return d;
  })

  // Convert array of values into a sensical object
  let data = [];
  result.forEach((row, i) => {
    // Skip if this is the header row
    if (i==0)
      return;
    exportRow = {};
    row.forEach((cell, i) => {
      // If this is a variable cell, make sure it's read as a number
      if (variables.find(f => result[0][i] === f.simpleName)) {
        cell = +cell;
      }
      exportRow[result[0][i]] = cell;
    })
    data.push(exportRow);
  })
  
  // Get urban index
  const urban_rural = await new Promise((complete, err) => {
    papaparse.parse(fs.createReadStream('./data/County_Rural_Lookup.csv'), {
      header: true,
      worker: false,
      complete,
      error: err
    });
  }).then((results) => {
    return results.data
  })
  
  data = data.map((d) => {
    const urbanity = urban_rural.find((f) => f['2015 GEOID'] === d.STATE + d.COUNTY);
    if (urbanity) {
      d['Percent urban'] = +urbanity['2010 Census \rPercent Rural'];
    } else {
      d['Percent urban'] = null;
    }
    
    return d;
  });
  
  fs.writeFileSync('export.json', JSON.stringify(data));
};
init();