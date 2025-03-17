/***************************************************************
 * 1) DYNAMIC HEARTBEAT SIMULATION (ECG) for the Minigame Page
 ***************************************************************/
let currentBpmRange = [60, 80]; // persists across rounds
let isDead = false; // if the user scores 0 out of 3, set this to true

// Use separate elements for heart rate value and unit
const heartRateValueElement = document.getElementById('heart-rate-value');
const heartRateUnitElement = document.getElementById('heart-rate-unit');
const heartIconElement = document.getElementById('heart-icon');
const svgWave = d3.select("#wave-svg");

// Remove any previous dynamic beat path if present.
svgWave.select("#dynamic-beat").remove();

const baseline = 300;

/** Animate the heartbeat line continuously **/
function beat() {
  if (isDead) return; // Stop heartbeat if player is "dead"

  const [minBpm, maxBpm] = currentBpmRange;
  const bpm = Math.floor(Math.random() * (maxBpm - minBpm + 1)) + minBpm;
  // Update separate elements so each part can have its own font
  heartRateValueElement.textContent = bpm;
  heartRateUnitElement.textContent = " BPM";

  heartIconElement.classList.add("heart-beat");
  setTimeout(() => { 
    heartIconElement.classList.remove("heart-beat"); 
  }, 300);

  // Adjust speed multiplier based on BPM range.
  let speedMultiplier = maxBpm <= 80 ? 1.5 : (maxBpm <= 125 ? 1.2 : 1.0);
  const beatDuration = (60000 / bpm) * speedMultiplier;
  
  // Map BPM to amplitude; more dramatic peaks for higher ranges.
  let amplitudeRange = maxBpm <= 80 ? [20, 100] : (maxBpm <= 125 ? [40, 160] : [60, 200]);
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

  svgWave.select("#dynamic-beat").remove();
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
let wrongCount = 0;
let cachedData = null; // to store JSON

/** On "Power" button in final screen, go to monitor */
function goToMonitorPage() {
  window.location.href = "monitor.html";
}

/** Move to next round or finalize score */
function nextRound() {
  currentRound++;
  if (currentRound < maxRounds) {
    fadeOutInRound(currentRound);
  } else {
    finalizeScore();
  }
}

/**
 * Display final results + short observations
 * with custom heart icons based on the final score.
 */
function finalizeScore() {
  const finalScore = userGuesses.filter(Boolean).length;
  d3.select("#minigame").selectAll("svg").remove();

  // Change the top-right heart icon based on final score
  // 3 -> ✅
  // 2 -> ❤️
  // 1 -> 💔
  // 0 -> 💀 (and flatline)
  if (finalScore === 3) {
    heartIconElement.innerHTML = "✅";
    heartIconElement.classList.remove("heart-beat");
    heartRateValueElement.textContent = "Perfect Score!";
    heartRateUnitElement.textContent = "";
  } else if (finalScore === 2) {
    heartIconElement.innerHTML = "❤️";
    heartIconElement.classList.remove("heart-beat");
    // Keep BPM text as-is
  } else if (finalScore === 1) {
    heartIconElement.innerHTML = "💔";
    heartIconElement.classList.remove("heart-beat");
    // Keep BPM text as-is
  } else {
    // finalScore === 0
    isDead = true;
    heartRateValueElement.textContent = "0";
    heartRateUnitElement.textContent = " BPM";
    heartIconElement.innerHTML = "💀";
    heartIconElement.classList.remove("heart-beat");
    // Stop the dynamic beat line
    svgWave.select("#dynamic-beat").remove();
    // Draw a flat line
    svgWave.append("path")
      .attr("d", "M 0,300 L 1200,300")
      .attr("stroke", "#e74c3c")
      .attr("stroke-width", 3)
      .attr("fill", "none");
  }
  
  // Update the minigame container with the final message
d3.select("#minigame").html(`
    <h2>You scored ${finalScore} out of ${maxRounds}!</h2>
    <div id="minigame-insights">
      <h3>Visual Observations</h3>
      <p>
        Lines corresponding to non-survivors often exhibit sharp declines, big spikes, 
        and erratic fluctuations, suggesting significant physiological instability. 
        By contrast, lines for survivors typically maintain steadier trends and smoother 
        transitions, indicating more stable conditions throughout the procedure.
      </p>
    </div>
    <button id="go-to-monitor-btn" class="fancy-button" style="margin-top: 15px;">
      Click here to go to the monitor
    </button>
  `);
  

  document.getElementById("go-to-monitor-btn")
    .addEventListener("click", goToMonitorPage);
}

/***************************************************************
 * 3) FUN FEEDBACK – bounce popup + floating emojis (stars/skulls)
 ***************************************************************/

/** Show the feedback popup with color + bounce + icon */
function showFeedback(message) {
  const popup = d3.select("#minigame-popup");
  
  // Remove old classes
  popup.classed("feedback-correct", false)
       .classed("feedback-wrong", false)
       .classed("popup-animate", false);

  // Decide styling based on "Wrong!" or "Correct!"
  if (message.toLowerCase().includes("wrong")) {
    popup.classed("feedback-wrong", true);
    popup.html(`<span style="font-size:1.5em;">❌</span> ${message}`);
    // Spawn some skull emojis
    spawnEmojis(10, "skull");
  } else if (message.toLowerCase().includes("correct")) {
    popup.classed("feedback-correct", true);
    popup.html(`<span style="font-size:1.5em;">✅</span> ${message}`);
    // Spawn some star emojis
    spawnEmojis(10, "star");
  } else {
    popup.html(message);
  }

  // Add the bounce animation class
  popup.classed("popup-animate", true);

  // Show the popup with a fade-in
  popup.style("display", "block")
       .transition().duration(300)
       .style("opacity", 1);

  // Hide the popup after 1.5 seconds
  setTimeout(() => {
    popup.transition().duration(300)
         .style("opacity", 0)
         .on("end", () => {
           popup.style("display", "none");
           // Reset classes so next time the bounce replays
           popup.classed("feedback-correct", false)
                .classed("feedback-wrong", false)
                .classed("popup-animate", false);
         });
  }, 1500);
}

/** Spawn fun floating emojis (stars for correct, skulls for wrong) */
function spawnEmojis(count, type = "star") {
  const container = document.body; // place them over the entire screen
  let emojis = [];

  if (type === "star") {
    emojis = ["✨", "🌟", "💫", "⭐"];
  } else if (type === "skull") {
    emojis = ["💀", "☠️", "😵"];
  } else {
    emojis = ["🎉"];
  }

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("div");
    emoji.classList.add("confetti-emoji");
    // pick a random emoji
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    emoji.textContent = randomEmoji;

    // random position near the center of the screen
    const x = window.innerWidth * 0.4 + (Math.random() * window.innerWidth * 0.2);
    const y = window.innerHeight * 0.4 + (Math.random() * window.innerHeight * 0.2);
    emoji.style.left = x + "px";
    emoji.style.top = y + "px";

    container.appendChild(emoji);

    // remove after the floatUp animation
    setTimeout(() => {
      emoji.remove();
    }, 2000);
  }
}

/***************************************************************
 * 4) ROUND DRAWING + DATA LOADING
 ***************************************************************/
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

/** Draw the round (2 lines: Survived vs. Death) */
function drawMiniGameRound(roundIndex) {
  d3.select("#minigame").selectAll("svg").remove();
  d3.select("#minigame-popup").style("display", "none");

  const param = parameters[roundIndex];

  if (!cachedData) {
    d3.select("#minigame").html("Loading data...");
    return;
  }

  const deathData = cachedData["Death"].flat().map(d => ({
    time: new Date(d.Time),
    value: +d[param]
  })).filter(d => !isNaN(d.value));
  const survivedData = cachedData["Survived"].flat().map(d => ({
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

  // Randomly shuffle the lines so user can guess
  for (let i = linesData.length - 1; i > 0; i--) {
    const randIndex = Math.floor(Math.random() * (i + 1));
    [linesData[i], linesData[randIndex]] = [linesData[randIndex], linesData[i]];
  }

  const allPoints = filteredDeathData.concat(filteredSurvivedData);
  const width = 600, height = 400;
  const margin = { top: 20, right: 20, bottom: 80, left: 40 };

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

  const svgMini = d3.select("#minigame")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const lineGenerator = d3.line()
    .x(d => x(d.time))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  // Draw both lines
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
        // One attempt per round
        if (lineObj.label === "survived") {
          userGuesses[roundIndex] = true;
          showFeedback("Correct!");
        } else {
          userGuesses[roundIndex] = false;
          wrongCount++;
          if (wrongCount === 1) {
            currentBpmRange = [110, 125];
          } else if (wrongCount === 2) {
            currentBpmRange = [130, 150];
          }
          updateBorderEffect();
          showFeedback("Wrong!");
        }
        setTimeout(nextRound, 1000);
      });
  });
}

/** Fade out + fade in to next round */
function fadeOutInRound(roundIndex) {
  d3.select("#minigame")
    .transition().duration(200)
    .style("opacity", 0)
    .on("end", function() {
      drawMiniGameRound(roundIndex);
      d3.select("#minigame")
        .transition().duration(200)
        .style("opacity", 1);
    });
}

/** Load data + start the minigame */
function initMiniGame() {
  currentRound = 0;
  userGuesses = [];
  wrongCount = 0;
  isDead = false;
  currentBpmRange = [60, 80];
  
  d3.select("#minigame-page").style("opacity", 0);

  d3.json("vital_signs_data.json").then(function(data) {
    cachedData = data;
    // Fade in the minigame container
    d3.select("#minigame-page").transition().duration(500).style("opacity", 1);
    drawMiniGameRound(currentRound);
  }).catch(function(error) {
    console.error("Error loading mini game data:", error);
    d3.select("#minigame").html("Error loading mini game.");
  });
}

initMiniGame();
