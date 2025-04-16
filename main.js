let main = d3.select("main");
let scrolly = main.select("#scrolly");
let svg = scrolly.select("svg");
let article = scrolly.select("article");
let step = article.selectAll(".step");

const margin = { top: 40, right: 150, bottom: 60, left: 100 };
let svgWidth = window.innerWidth * 0.65;
let width = svgWidth - margin.left - margin.right;
let height = 500;

let scroller = scrollama();
let data;

let xAxisGroup, yAxisGroup;
let xScatterScale, yScatterScale;
let isBarChart = false;
let usGeo = null;
const path = d3.geoPath();

const gCurrent = svg.append("g").attr("class", "currentLayer");
const gNext = svg.append("g").attr("class", "nextLayer").style("opacity", 0);

let scatterX, scatterY, colorScale;



function tryInit() {
    if (data && usGeo) {
        init();
    }
}

d3.json("states.json").then(function (topoData) {
    usGeo = topoData;
    tryInit();
});

d3.csv("state_crime.csv").then(function (d) {
    data = d.map(d => ({
        ...d,
        state: d.State,
        year: +d.Year,
        population: +d.Population,
        area: +d.Area,
        rate_property: +d.RatesPropertyAll,
        rate_violent: +d.RatesViolentAll,
        rate_assault: +d.RatesViolentAssault,
        rate_murder: +d.RatesViolentMurder,
        rate_rape: +d.RatesViolentRape,
        rate_robbery: +d.RatesViolentRobbery,
        total_violent: +d.TotalViolentAll,
        total_assault: +d.TotalViolentAssault,
        total_murder: +d.TotalsViolentMurder,
        total_rape: +d.TotalsViolentRape,
        total_robbery: +d.TotalsViolentRobbery
    }));
    tryInit();
});

function init() {
    handleResize();

    svg.selectAll('.scatterGroup').remove();
    svg.append('g')
        .attr('class', 'scatterGroup')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    scroller
        .setup({
            step: "#scrolly article .step",
            offset: 0.33,
            debug: false
        })
        .onStepEnter(handleStepEnter)
        // .onStepExit(handleStepExit);

    window.addEventListener('resize', handleResize);
}

function handleResize() {
    let stepH = Math.floor(window.innerHeight * 0.75);
    step.style("height", stepH + "px");

    svgWidth = window.innerWidth * 0.65;
    width = svgWidth - margin.left - margin.right;
    let svgHeight = height + margin.top + margin.bottom;

    svg
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    scroller.resize();
}

function handleStepEnter(response) {
    step.classed("is-active", (d, i) => i === response.index);

    switch (response.index) {
        case 0:
            document.getElementById("slider-container").style.display = "none";
            hideScatterplot();
            createMapLayers(); // Only run once!
            hideStackedAreaChart();
            break;
        case 1:
            document.getElementById("slider-container").style.display = "none";
            hideScatterplot();
            showMapLayer("20th");
            hideStackedAreaChart();
            break;
        case 2:
            document.getElementById("slider-container").style.display = "none";
            hideScatterplot();
            showMapLayer("21st");
            hideStackedAreaChart();
            break;
        case 3:
            document.getElementById("slider-container").style.display = "none";
            hideScatterplot();
            showMapLayer("21st");
            highlightGeorgia(true);
            hideStackedAreaChart();
            break;
        case 4:
            document.getElementById("slider-container").style.display = "none";
            hideMap();
            createScatterplot();
            resetHighlighting();
            hideStackedAreaChart();
            break;
        case 5:
            document.getElementById("slider-container").style.display = "none";
            highlightCategory("rate_assault");
            hideStackedAreaChart();
            break;
        case 6:
            document.getElementById("slider-container").style.display = "none";
            hideBarChart();
            createScatterplot();
            highlightCategory("rate_robbery");
            hideStackedAreaChart();
            break;
        case 7:
            document.getElementById("slider-container").style.display = "none";
            resetHighlighting();
            transitionToBarChart();
            setTimeout(() => {
                hideScatterplot();
            }, 1000);
            hideStackedAreaChart();
            break;
        case 8:
            hideBarChart();
            createStackedAreaChart();
            document.getElementById("slider-container").style.display = "block";
            break;



    }
}

function createMapLayers() {
    svg.selectAll("*").remove();

    // Precompute averages
    const rate20th = d3.rollup(data.filter(d => d.year < 2000), v => d3.mean(v, d => d.rate_violent), d => d.state);
    const rate21st = d3.rollup(data.filter(d => d.year >= 2000), v => d3.mean(v, d => d.rate_violent), d => d.state);

    const values = [...rate20th.values(), ...rate21st.values()];
    const color = d3.scaleSequential()
        .domain([d3.min(values), d3.max(values)])
        .interpolator(d3.interpolateReds);

    const stateIdToName = new Map([
        [1, "Alabama"], [2, "Alaska"], [4, "Arizona"], [5, "Arkansas"], [6, "California"],
        [8, "Colorado"], [9, "Connecticut"], [10, "Delaware"], [11, "District of Columbia"],
        [12, "Florida"], [13, "Georgia"], [15, "Hawaii"], [16, "Idaho"], [17, "Illinois"],
        [18, "Indiana"], [19, "Iowa"], [20, "Kansas"], [21, "Kentucky"], [22, "Louisiana"],
        [23, "Maine"], [24, "Maryland"], [25, "Massachusetts"], [26, "Michigan"], [27, "Minnesota"],
        [28, "Mississippi"], [29, "Missouri"], [30, "Montana"], [31, "Nebraska"], [32, "Nevada"],
        [33, "New Hampshire"], [34, "New Jersey"], [35, "New Mexico"], [36, "New York"],
        [37, "North Carolina"], [38, "North Dakota"], [39, "Ohio"], [40, "Oklahoma"],
        [41, "Oregon"], [42, "Pennsylvania"], [44, "Rhode Island"], [45, "South Carolina"],
        [46, "South Dakota"], [47, "Tennessee"], [48, "Texas"], [49, "Utah"], [50, "Vermont"],
        [51, "Virginia"], [53, "Washington"], [54, "West Virginia"], [55, "Wisconsin"], [56, "Wyoming"]
    ]);

    d3.json("https://raw.githubusercontent.com/vega/vega-datasets/master/data/us-10m.json").then(us => {
        const states = topojson.feature(us, us.objects.states).features;

        projection = d3.geoAlbersUsa().fitSize([width, height], { type: "FeatureCollection", features: states });
        path.projection(projection);

        ["map20th", "map21st"].forEach(layer => {
            svg.append("g")
                .attr("class", layer)
                .selectAll("path")
                .data(states)
                .join("path")
                .attr("class", d => {
                    const stateName = stateIdToName.get(d.id);
                    return "state " + (stateName === "Georgia" ? "georgia" : "");
                })                
                .attr("d", path)
                .attr("fill", d => {
                    const stateName = stateIdToName.get(d.id);
                    const value = layer === "map20th" ? rate20th.get(stateName) : rate21st.get(stateName);
                    return value != null ? color(value) : "#ccc";
                })
                .attr("stroke", "#eee")
                .attr("stroke-width", 0.5);
                const tooltip = d3.select("#tooltip");

                svg.selectAll("path.state")
                    .on("mouseenter", function (event, d) {
                        const stateName = stateIdToName.get(d.id);
                        const rate = d3.select(this.parentNode).attr("class") === "map20th"
                            ? rate20th.get(stateName)
                            : rate21st.get(stateName);
                        //console.log(rate20th.get(stateName), rate21st.get(stateName));

                        tooltip
                            .style("opacity", 1)
                            .html(`<strong>${stateName}</strong><br>Avg Violent Crime Rate: ${rate?.toFixed(1) ?? 'N/A'}`);
                    })
                    .on("mousemove", function (event) {
                        tooltip
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseleave", function () {
                        tooltip.style("opacity", 0);
                    });
        });

        // Start with 20th century visible
        svg.select(".map20th")
        .style("opacity", 1)
        .style("pointer-events", "all");

        svg.select(".map21st")
        .style("opacity", 0)
        .style("pointer-events", "none");


        svg.append("text")
        .attr("class", "bar-layer")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height + 10)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-style", "italic")
        .text("Crime Rate refers to Rate per 100,000 people.");
    });
}

function showMapLayer(layer) {
    const [fadeIn, fadeOut] = layer === "20th" ? [".map20th", ".map21st"] : [".map21st", ".map20th"];

    svg.select(fadeIn)
        .transition().duration(1000)
        .style("opacity", 1)
        .style("pointer-events", "all");

    svg.select(fadeOut)
        .transition().duration(1000)
        .style("opacity", 0)
        .style("pointer-events", "none");
}


function highlightGeorgia(shouldHighlight) {
    svg.selectAll(".georgia")
        .transition().duration(500)
        .attr("stroke", shouldHighlight ? "#000" : "#eee")
        .attr("stroke-width", shouldHighlight ? 2.5 : 0.5);
}

function createScatterplot() {
    svg.selectAll(".scatterplot-layer").remove();  // Ensure clean redraw if called again

    const scatterLayer = svg.append("g")
        .attr("class", "scatterplot-layer");


    // Filter Georgia data
    const gaData = data.filter(d => d.state === "Georgia");

    // Prepare data per category
    const categories = [
        { key: "rate_murder", label: "Homicide" },
        { key: "rate_rape", label: "Rape" },
        { key: "rate_robbery", label: "Robbery" },
        { key: "rate_assault", label: "Aggravated Assault" }
    ];

    const color = d3.scaleOrdinal()
        .domain(categories.map(c => c.label))
        .range(d3.schemeDark2);

    const margin = { top: 40, right: 100, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = scatterLayer.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(gaData, d => d.year))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(gaData, d =>
            Math.max(d.rate_murder, d.rate_rape, d.rate_robbery, d.rate_assault)
        )]).nice()
        .range([innerHeight, 0]);

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y));

    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 30)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Year");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Violent Crime Rate per 100,000");

    // Plot dots for each category
    categories.forEach(cat => {
        g.selectAll(`.dot-${cat.key}`)
            .data(gaData)
            .join("circle")
            .attr("class", `dot ${cat.key}`)
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d[cat.key]))
            .attr("r", 4)
            .attr("fill", color(cat.label))
            .attr("opacity", 0)
            .transition()
            .delay(200)
            .duration(500)
            .attr("opacity", 0.8);

            const tooltip = d3.select("#tooltip");

            categories.forEach(cat => {
                g.selectAll(`.dot.${cat.key}`)
                    .on("mouseenter", function (event, d) {
                        tooltip
                            .style("opacity", 1)
                            .html(`<strong>${cat.label}</strong><br>Year: ${d.year}<br>Rate: ${d[cat.key].toFixed(1)}`);
                    })
                    .on("mousemove", function (event) {
                        tooltip
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseleave", function () {
                        tooltip.style("opacity", 0);
                    });
            });
            
    });



    // Legend
    const legend = scatterLayer.append("g")
        .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    categories.forEach((cat, i) => {
        const yOffset = i * 20;
        legend.append("circle")
            .attr("cx", 0)
            .attr("cy", yOffset)
            .attr("r", 5)
            .attr("fill", color(cat.label));

        legend.append("text")
            .attr("x", 10)
            .attr("y", yOffset + 4)
            .text(cat.label)
            .style("font-size", "12px")
            .attr("fill", "white");
    });

    scatterX = x;
    scatterY = y;
    colorScale = color; 

}

function hideScatterplot() {
    svg.selectAll(".scatterplot-layer")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove(); 
}


function hideMap() {
    svg.selectAll(".map20th, .map21st")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .style("pointer-events", "none");
}


function highlightCategory(categoryKey) {
    svg.selectAll(".dot")
        .transition()
        .duration(500)
        .style("opacity", 0.1)
        .attr("stroke-width", 0)
        .attr("stroke", "none");

    svg.selectAll(`.dot.${categoryKey}`)
        .transition()
        .duration(500)
        .style("opacity", 1)
        .attr("stroke-width", 2.5)
        .attr("stroke", "white");
}

function resetHighlighting() {
    svg.selectAll(".dot")
        .transition()
        .duration(500)
        .style("opacity", 0.8)
        .attr("stroke-width", 0)
        .attr("stroke", "none");
}




function transitionToBarChart() {
    const latest = data.find(d => d.state === "Georgia" && d.year === 2019);
    if (!latest) return;

    const categories = [
        { key: "rate_murder", label: "Homicide" },
        { key: "rate_rape", label: "Rape" },
        { key: "rate_robbery", label: "Robbery" },
        { key: "rate_assault", label: "Aggravated Assault" }
    ];

    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const barX = d3.scaleBand()
        .domain(categories.map(c => c.label))
        .range([0, innerWidth])
        .padding(0.3);

    const barY = d3.scaleLinear()
        .domain([0, d3.max(categories, c => latest[c.key])])
        .nice()
        .range([innerHeight, 0]);

    // Move scatterplot dots to bar positions
    categories.forEach(cat => {
        svg.selectAll(`.dot.${cat.key}`)
            .transition()
            .duration(1000)
            .attr("cx", d => margin.left + barX(cat.label) + barX.bandwidth() / 2)
            .attr("cy", d => margin.top + barY(latest[cat.key]));
    });

    const barLayer = svg.append("g")
        .attr("class", "bar-layer")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Y-axis
    barLayer.append("g")
        .call(d3.axisLeft(barY).ticks(5))
        .selectAll("text")
        .attr("fill", "white");

    barLayer.selectAll(".domain, .tick line")
        .attr("stroke", "white");

    // X-axis
    barLayer.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(barX))
        .selectAll("text")
        .attr("fill", "white");

    barLayer.selectAll(".x.axis .domain, .x.axis .tick line")
        .attr("stroke", "white");

    // Bars
    barLayer.selectAll("rect")
        .data(categories)
        .join("rect")
        .attr("x", d => barX(d.label))
        .attr("width", barX.bandwidth())
        .attr("y", d => barY(latest[d.key]))
        .attr("height", d => innerHeight - barY(latest[d.key]))
        .attr("fill", d => colorScale(d.label))
        .attr("opacity", 0)
        .transition()
        .delay(800)
        .duration(500)
        .attr("opacity", 1);

    // Value labels above bars
    barLayer.selectAll(".bar-label")
        .data(categories)
        .join("text")
        .attr("class", "bar-label")
        .attr("x", d => barX(d.label) + barX.bandwidth() / 2)
        .attr("y", d => barY(latest[d.key]) - 10)
        .attr("text-anchor", "middle")
        .text(d => latest[d.key].toFixed(1))
        .attr("fill", "white")
        .attr("opacity", 0)
        .transition()
        .delay(800)
        .duration(500)
        .attr("opacity", 1);

    // Axis Titles
    svg.append("text")
        .attr("class", "bar-layer")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Crime Type");

    svg.append("text")
        .attr("class", "bar-layer")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Rate per 100,000 people");
}



function hideScatterplotDots() {
    svg.selectAll(".dot")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();
}


function hideBarChart() {
    svg.selectAll(".bar-layer")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();
}


function createStackedAreaChart() {
    svg.selectAll(".area-layer").remove();

    const georgiaData = data.filter(d => d.state === "Georgia");
    const categories = ["rate_murder", "rate_rape", "rate_robbery", "rate_assault"];

    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleLinear().range([0, innerWidth]);
    const y = d3.scaleLinear().range([innerHeight, 0]);
    const color = d3.scaleOrdinal().domain(categories).range(d3.schemeDark2);
    const area = d3.area().x(d => x(d.data.year)).y0(d => y(d[0])).y1(d => y(d[1]));
    const stack = d3.stack().keys(categories);

    const areaLayer = svg.append("g")
        .attr("class", "area-layer")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // DOM refs
    const slider = document.getElementById("yearRange");
    const label = document.getElementById("yearLabel");

    // Initialize chart with full range
    updateChart(+slider.value);

    // On slider input
    slider.oninput = () => {
        updateChart(+slider.value);
    };

    function updateChart(maxYear) {
        label.textContent = `1960 – ${maxYear}`;

        const filtered = georgiaData.filter(d => d.year >= 1960 && d.year <= maxYear);

        const processed = d3.rollups(
            filtered,
            v => {
                const base = { year: v[0].year };
                categories.forEach(key => base[key] = d3.mean(v, d => d[key]));
                return base;
            },
            d => d.year
        ).map(([year, obj]) => obj);

        const stackedData = stack(processed);

        x.domain(d3.extent(processed, d => d.year));
        y.domain([0, d3.max(processed, d => categories.reduce((sum, key) => sum + d[key], 0))]).nice();

        // Draw/update axes
        areaLayer.selectAll(".x-axis").remove();
        areaLayer.selectAll(".y-axis").remove();

        areaLayer.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")))
            .selectAll("text")
            .attr("fill", "white");

        areaLayer.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .attr("fill", "white");

        areaLayer.selectAll(".domain, .tick line")
            .attr("stroke", "white");

        // Bind and draw areas
        const paths = areaLayer.selectAll(".layer")
            .data(stackedData, d => d.key);

        paths.enter()
            .append("path")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .attr("opacity", 0.85)
            .merge(paths)
            .attr("opacity", 0)
            .transition()
            .delay(200)
            .duration(500)
            .attr("opacity", 1)
            .attr("d", area);

        paths.exit().remove();
    }

    // Axis labels
    svg.append("text")
        .attr("class", "area-layer")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Year");

    svg.append("text")
        .attr("class", "area-layer")
        .attr("x", -height / 2)
        .attr("y", 20)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text("Violent Crime Rate");

    // Legend
    const legend = svg.append("g")
        .attr("class", "area-layer")
        .attr("transform", `translate(${width - margin.right - 100}, ${margin.top})`);

    categories.forEach((cat, i) => {
        const yOffset = i * 20;
        legend.append("rect")
            .attr("x", 0)
            .attr("y", yOffset)
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", color(cat));

        legend.append("text")
            .attr("x", 15)
            .attr("y", yOffset + 9)
            .text(cat.replace("rate_", "").toUpperCase())
            .attr("fill", "white")
            .style("font-size", "12px");
    });
}

function hideStackedAreaChart() {
    svg.selectAll(".area-layer")
        .transition()
        .duration(500)
        .style("opacity", 0);
}





/*function createMap2() {
    svg.selectAll("*").remove();

    d3.json("https://raw.githubusercontent.com/vega/vega-datasets/master/data/us-10m.json").then(us => {
        console.log(us);
        const states = topojson.feature(us, us.objects.states).features;
        projection = d3.geoAlbersUsa().fitSize([width, height], { type: "FeatureCollection", features: states });
        path.projection(projection);

        svg.selectAll("path")
            .data(states)
            .join("path")
            .attr("d", path)
            .attr("fill", "#444")
            .attr("stroke", "#eee")
            .attr("stroke-width", 0.5);
    });
}*/

