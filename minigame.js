/***************************************************************
 * 1) DYNAMIC HEARTBEAT SIMULATION (ECG) for the Minigame Page
 ***************************************************************/

// Global BPM range persists across rounds (only increased if a round is answered incorrectly).
let currentBpmRange = [60, 80];

// We'll use this flag to stop the heartbeat if the user ends with 0 out of 3.
let isDead = false;

const heartRateElement = document.getElementById('heart-rate');
const heartIconElement = document.getElementById('heart-icon');
const svgWave = d3.select("#wave-svg");

// Remove any previous dynamic beat path if present.
svgWave.select("#dynamic-beat").remove();

const baseline = 300;

function beat() {
  // If user is "dead" (0 out of 3), do not continue animating.
  if (isDead) return;

  const [minBpm, maxBpm] = currentBpmRange;
  const bpm = Math.floor(Math.random() * (maxBpm - minBpm + 1)) + minBpm;
  heartRateElement.textContent = bpm + " BPM";

  // Pulse the heart icon (unless isDead is true).
  heartIconElement.classList.add("heart-beat");
  setTimeout(() => {
    heartIconElement.classList.remove("heart-beat");
  }, 300);

  // Adjust beat duration based on BPM range.
  let speedMultiplier;
  if (maxBpm <= 80) {
    speedMultiplier = 1.5;
  } else if (maxBpm <= 125) {
    speedMultiplier = 1.2;
  } else {
    speedMultiplier = 1.0;
  }
  const beatDuration = (60000 / bpm) * speedMultiplier;
  
  // More dramatic amplitude for higher BPM.
  let amplitudeRange;
  if (maxBpm <= 80) {
    amplitudeRange = [20, 100];
  } else if (maxBpm <= 125) {
    amplitudeRange = [40, 160];
  } else {
    amplitudeRange = [60, 200];
  }
  const amplitude = d3.scaleLinear().domain([minBpm, maxBpm]).range(amplitudeRange)(bpm);

  const beatData = [
    { x: 0, y: baseline },
    { x: beatDuration * 0.2, y: baseline - amplitude },
    { x: beatDuration * 0.25, y: baseline + amplitude * 0.3 },
    { x: beatDuration, y: baseline }
  ];

  const totalBeatWidth = 1200;
  const lineGenerator = d3.line()
    .x(d => (d.x / beatDuration) * totalBeatWidth)
    .y(d => d.y)
    .curve(d3.curveMonotoneX);

  // Remove any old beat path.
  svgWave.select("#dynamic-beat").remove();

  // Append new path for the current beat.
  const path = svgWave.append("path")
    .attr("id", "dynamic-beat")
    .attr("d", lineGenerator(beatData))
    .attr("stroke", "#e74c3c")
    .attr("stroke-width", 3)
    .attr("fill", "none");

  const totalLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", totalLength)
    .attr("stroke-dashoffset", totalLength)
    .transition()
      .duration(beatDuration)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0)
      .on("end", beat);
}

// Start the continuous heartbeat simulation.
beat();

/***************************************************************
 * 2) MINI GAME LOGIC – 3 Rounds, Each with a Different Parameter
 ***************************************************************/
const parameters = [
  "Solar8000/ART_DBP",
  "Solar8000/ART_SBP",
  "Solar8000/PLETH_SPO2"
];

let currentRound = 0;
let userGuesses = [];
const maxRounds = parameters.length;
// Track the total number of wrong answers
let wrongCount = 0;

function goToGraphsPage() {
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
  
  // If user scored 0 out of 3, "kill" the heartbeat
  if (finalScore === 0) {
    // Stop the beat function
    isDead = true;
    // Force BPM to 0
    heartRateElement.textContent = "0 BPM";
    // Remove any existing dynamic beat
    svgWave.select("#dynamic-beat").remove();
    // Draw a flat red line
    svgWave.append("path")
      .attr("d", "M 0,300 L 1200,300")
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 3)
      .attr("fill", "none");
  }

  d3.select("#minigame").html(`
    <h2>You scored ${finalScore} out of ${maxRounds}!</h2>
    <button id="go-to-graphs-btn" class="fancy-button" style="margin-top: 15px;">
      Click here to explore the rest of the graphs
    </button>
  `);

  document.getElementById("go-to-graphs-btn")
    .addEventListener("click", goToGraphsPage);
}

function showFeedback(message) {
  const popup = d3.select("#minigame-popup");
  popup.html(message)
       .style("display", "block")
       .transition()
         .duration(300)
         .style("opacity", 1);
  setTimeout(() => {
    popup.transition()
         .duration(300)
         .style("opacity", 0)
         .on("end", () => popup.style("display", "none"));
  }, 1000);
}

// Add or update a red border effect if user is wrong
function updateBorderEffect() {
  const container = document.getElementById("minigame-page");
  if (wrongCount === 1) {
    container.classList.remove("wrong2");
    container.classList.add("wrong1");
  } else if (wrongCount >= 2) {
    container.classList.remove("wrong1");
    container.classList.add("wrong2");
  }
}

function drawMiniGameRound(roundIndex) {
  d3.select("#minigame").selectAll("svg").remove();
  d3.select("#minigame-popup").style("display", "none");

  const param = parameters[roundIndex];

  d3.json("vital_signs_data.json").then(function(rawData) {
    const deathData = rawData["Death"].flat().map(d => ({
      time: new Date(d.Time),
      value: +d[param]
    })).filter(d => !isNaN(d.value));
    const survivedData = rawData["Survived"].flat().map(d => ({
      time: new Date(d.Time),
      value: +d[param]
    })).filter(d => !isNaN(d.value));

    const cutoffDate = new Date('1969-12-31T22:00:00');
    const filteredDeathData = deathData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);
    const filteredSurvivedData = survivedData.filter(d => d.time < cutoffDate && d.time.getFullYear() === 1969);

    if (filteredDeathData.length === 0 || filteredSurvivedData.length === 0) {
      d3.select("#minigame").html("No mini game data available for this parameter.");
      return;
    }

    let linesData = [
      { points: filteredDeathData, label: "death" },
      { points: filteredSurvivedData, label: "survived" }
    ];

    for (let i = linesData.length - 1; i > 0; i--) {
      const randIndex = Math.floor(Math.random() * (i + 1));
      [linesData[i], linesData[randIndex]] = [linesData[randIndex], linesData[i]];
    }

    const allPoints = filteredDeathData.concat(filteredSurvivedData);
    const width = 600, height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const x = d3.scaleTime()
      .domain(d3.extent(allPoints, d => d.time))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(allPoints, d => d.value) * 0.95,
        d3.max(allPoints, d => d.value) * 1.05
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Create an SVG for the minigame chart (no axes).
    const svgMini = d3.select("#minigame")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const lineGenerator = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    // One attempt per round
    linesData.forEach(lineObj => {
      svgMini.append("path")
        .datum(lineObj.points)
        .attr("d", lineGenerator)
        .style("stroke", "#888")
        .style("stroke-width", 3)
        .style("fill", "none")
        .on("mouseover", function() {
          d3.select(this).transition().duration(150).style("stroke", "#e74c3c");
        })
        .on("mouseout", function() {
          d3.select(this).transition().duration(150).style("stroke", "#888");
        })
        .on("click", () => {
          if (lineObj.label === "survived") {
            userGuesses[roundIndex] = true;
            showFeedback("Correct!");
          } else {
            userGuesses[roundIndex] = false;
            wrongCount++;
            // Increase BPM range cumulatively:
            if (wrongCount === 1) {
              currentBpmRange = [110, 125];
            } else if (wrongCount === 2) {
              currentBpmRange = [130, 150];
            }
            // Update the red border effect
            updateBorderEffect();
            showFeedback("Wrong!");
          }
          setTimeout(nextRound, 1000);
        });
    });
  }).catch(function(error) {
    console.error("Error loading mini game data:", error);
    d3.select("#minigame").html("Error loading mini game.");
  });
}

function initMiniGame() {
  currentRound = 0;
  userGuesses = [];
  wrongCount = 0;
  currentBpmRange = [60, 80]; // Start with the default range
  // Remove any existing red border classes
  document.getElementById("minigame-page").classList.remove("wrong1", "wrong2");
  drawMiniGameRound(currentRound);
}

initMiniGame();
