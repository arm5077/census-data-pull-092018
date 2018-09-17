const request = require('request-promise-native'),
  fs = require('fs'),
  papaparse = require('papaparse'),
  variables = require('./variables.json'),
  transforms = require('./transforms.json'),
  quantiles = {
    25: {},
    50: {},
    75: {},
    90: {},
    100: {}
  };
let data = [];

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
  });
  
  data = data.map((d) => {
    const urbanity = urban_rural.find((f) => f['2015 GEOID'] === d.STATE + d.COUNTY);
    if (urbanity) {
      d['Percent urban'] = 100 - +urbanity['2010 Census \rPercent Rural'];
    } else {
      d['Percent urban'] = null;
    }
    return d;
  });
  
  // Make summed columns
  data.forEach((county) => {
    transforms.forEach((variable) => {
      if (variable.type !== 'addTo') {
        return
      }
      let newColumn = 0;
      variable.addTo.forEach((column) => {
        newColumn += county[column];
      });
      county[variable.newName] = newColumn;
    });
  });
  
  // Calculate rates
  data.forEach((county) => {
    transforms.forEach((variable) => {
      if (variable.type !== 'makeRate') {
        return;
      }
      let numerator = county[variable.simpleName];
      let rate = numerator / county[variable.denominator];
      county[variable.rateName] = rate;
    });
  });
  
    
  // Make quantiles
  transforms.forEach((variable) => {
    if (variable.type !== 'getQuartile') {
      return;
    }    
    data.sort((a,b) => a[variable.simpleName] - b[variable.simpleName]);
    const slice = data.map((d) => {
      return d[variable.simpleName]
    });
      
    [25, 50, 75, 90, 100].forEach((n) => {
      quantiles[n][variable.simpleName] = slice[Math.floor(slice.length * n / 100)];
    });
  });
  
  // Apply county archetype labels
  archetypes.forEach((archetype) => {
    data.forEach((county) => {
      county[archetype.name] = archetype.classifier(county);
    })
  })
  
  fs.writeFileSync('export.json', JSON.stringify(data, null, " "));
};
init();

const archetypes = [
  {
    name: "Diverse suburb",
    classifier: function(county) {
      // Suburbs currently defined as being above median for percent urban but below 100%
      const suburbs = data.filter((d) => {
        return d['Percent urban'] > quantiles[50]['Percent urban'] && d['Percent urban'] < 100;
      });
      
      // Calculates the median White NH population among suburbs.
      const medianSuburbDiversity = suburbs.sort((a,b) => a['Percent white non-Hispanic'] - b['Percent white non-Hispanic'])[Math.round(suburbs.length / 2)]["Percent white non-Hispanic"];
      const diverseSuburbs = suburbs.filter((d) => d['Percent white non-Hispanic'] < medianSuburbDiversity);
      
      // Is this county within the list of diverse suburbs?
      return diverseSuburbs.filter((d) => d.NAME == county.NAME).length > 0;
    }
  },
  {
    name: "Majority minority",
    classifier: function(county) {
      return county['Percent white non-Hispanic'] < .5;
    }
  },
  {
    name: "Wealthy enclave",
    classifier: function(county) {
      return county['Median household income'] >= quantiles[90]['Median household income'];
    }
  },
  {
    name: "Manufacturing/mining town",
    classifier: function(county) {
      return county['Percent employed in manufacturing, agriculture, and mining'] >= quantiles[75]['Percent employed in manufacturing, agriculture, and mining'];
    }
  }
]