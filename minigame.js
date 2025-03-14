/***************************************************************
 * MINI GAME LOGIC (3 Rounds, no immediate feedback, random lines)
 ***************************************************************/
let currentRound = 0;
let userGuesses = []; // store booleans for user’s guess correctness
const maxRounds = 3;

function goToGraphsPage() {
  // Navigate to the graphs page (graph.html)
  window.location.href = "graph.html";
}

function nextRound() {
  currentRound++;
  if (currentRound < maxRounds) {
    drawMiniGameRound(currentRound);
  } else {
    finalizeScore();
  }
}

function finalizeScore() {
  const finalScore = userGuesses.filter(Boolean).length;
  d3.select("#minigame").selectAll("svg").remove();
  
  // Insert a fancy button for exploring the graphs
  d3.select("#minigame").html(`
    <h2>You scored ${finalScore} out of ${maxRounds}!</h2>
    <button id="go-to-graphs-btn" class="fancy-button" style="margin-top: 15px;">
      Click here to explore the rest of the graphs
    </button>
  `);
  
  // Event listener for that fancy button
  document.getElementById("go-to-graphs-btn")
    .addEventListener("click", goToGraphsPage);
}

function getDataSegment(fullData, roundIndex) {
  const segSize = Math.floor(fullData.length / maxRounds);
  const endIdx = segSize * (roundIndex + 1);
  if (roundIndex === maxRounds - 1) {
    return fullData.slice(0);
  }
  return fullData.slice(0, endIdx);
}

function drawMiniGameRound(roundIndex) {
  d3.select("#minigame").selectAll("svg").remove();
  d3.select("#minigame-popup").style("display", "none");

  d3.json("vital_signs_data.json").then(function(rawData) {
    const deathData = rawData["Death"].flat().map(d => ({
      time: new Date(d.Time),
      value: +d["Solar8000/ETCO2"]
    })).filter(d => !isNaN(d.value));
    const survivedData = rawData["Survived"].flat().map(d => ({
      time: new Date(d.Time),
      value: +d["Solar8000/ETCO2"]
    })).filter(d => !isNaN(d.value));

    const cutoffDate = new Date('1969-12-31T22:00:00');
    const filteredDeathData = deathData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);
    const filteredSurvivedData = survivedData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);

    const every30thDeathData = filteredDeathData.filter((d, i) => i % 30 === 0);
    const every30thSurvivedData = filteredSurvivedData.filter((d, i) => i % 30 === 0);

    if (every30thDeathData.length === 0 || every30thSurvivedData.length === 0) {
      d3.select("#minigame").html("No mini game data available.");
      return;
    }

    const partialDeath = getDataSegment(every30thDeathData, roundIndex);
    const partialSurvived = getDataSegment(every30thSurvivedData, roundIndex);

    let linesData = [
      { points: partialDeath, label: "death" },
      { points: partialSurvived, label: "survived" }
    ];

    // Random shuffle
    for (let i = linesData.length - 1; i > 0; i--) {
      const randIndex = Math.floor(Math.random() * (i + 1));
      [linesData[i], linesData[randIndex]] = [linesData[randIndex], linesData[i]];
    }

    const allPoints = partialDeath.concat(partialSurvived);
    const width = 600, height = 400;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const x = d3.scaleTime()
      .domain(d3.extent(every30thDeathData.concat(every30thSurvivedData), d => d.time))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(allPoints, d => d.value) * 0.95,
        d3.max(allPoints, d => d.value) * 1.05
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svg = d3.select("#minigame")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const lineGenerator = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    // Draw lines in neutral color with interactivity
    linesData.forEach((lineObj) => {
      svg.append("path")
        .datum(lineObj.points)
        .attr("d", lineGenerator)
        .style("stroke", "#888")
        .style("stroke-width", 3)
        .style("fill", "none")
        .on("mouseover", function() {
          d3.select(this).transition().duration(150).style("stroke-width", 5);
        })
        .on("mouseout", function() {
          d3.select(this).transition().duration(150).style("stroke-width", 3);
        })
        .on("click", () => {
          // user guessed "this line is survivors"
          userGuesses[roundIndex] = (lineObj.label === "survived");
          nextRound();
        });
    });
  }).catch(function(error) {
    console.error("Error loading mini game data:", error);
    d3.select("#minigame").html("Error loading mini game.");
  });
}

// Initialize the mini game when the page loads.
function initMiniGame() {
  currentRound = 0;
  userGuesses = [];
  drawMiniGameRound(currentRound);
}

// Automatically initialize the mini game on load.
initMiniGame();
