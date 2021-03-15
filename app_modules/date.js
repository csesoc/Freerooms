// CONSTS
const CALENDAR_URL = "https://student.unsw.edu.au/calendar";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TERMS = {
  "Summer Term": "U1",
  "Term 1": "T1",
  "Term 2": "T2",
  "Term 3": "T3",
};

// MODULES
const puppeteer = require("puppeteer");

// Scrape current academic calendar for key dates and return a dictionary
// TODO this is broken
const scrapeKeyDates = async () => {
  try {
    // Create new browser and page
    // TODO remove no sandbox later when with debian;
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Loaded browser");

    const page = await browser.newPage();
    console.log("Loaded newPage");

    // TODO what does this do??
    //////////////////////////// CONSOLE.LOG CODEBLOCK ////////////////////////////
    page.on("console", log => console[log._type](log._text));
    console.log("loaded page eval console.log");
    ///////////////////////////////////////////////////////////////////////////////

    // Visit calendar page
    await page.goto(CALENDAR_URL, { waitUntil: "domcontentloaded" });
    console.log("Loaded UNSW calendar");

    // Get key dates as a dictionary
    const result = await page.evaluate(() => {
      const MONTHS = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];

      let yearInfo = document
        .querySelector(".table-striped")
        .querySelector("tr");

      let container = [];
      // TODO is the element at index 1 is for 2020? can we generate this programatically
      document
        .querySelectorAll(".table-striped")
        .forEach(el => container.push(el.querySelectorAll("tr")[1]));

      let keyDates = {};

      // For each year on the page, store term data in array
      yearInfo.querySelectorAll("td").forEach(el => {
        // For YEAR table label
        if (el.innerText == "YEAR") return;

        let yearList = [];
        container.map(e => {
          // Get raw dates string from table
          // Example date string: "15 Feb - 13 May"
          let dateString = e.querySelectorAll("td")[
            Array.from(yearInfo.querySelectorAll("td")).indexOf(el)
          ].innerText;
          dateString = dateString.trim();

          // Dirty fix - set all 'words' to be 3 characters long (for month->num conversion)
          let d = [];
          dateString.split(" ").forEach(word => d.push(word.substr(0, 3)));
          dateString = d.join(" ");

          // Split dateString into an array
          let dates = [];
          dateString.split("-").forEach(date => dates.push(date.trim()));

          // Construct object to store relevant information about term
          let year = el.innerText;
          let startDate = new Date(
            year,
            MONTHS.indexOf(dates[0].replace(/[0-9 ]+/g, "").toUpperCase()),
            Number(dates[0].replace(/[A-Za-z ]+/g, ""))
          );
          let endDate = new Date(
            year,
            MONTHS.indexOf(dates[1].replace(/[0-9 ]+/g, "").toUpperCase()),
            Number(dates[1].replace(/[A-Za-z ]+/g, ""))
          );
          let term = e.querySelectorAll("td")[0].innerText;

          // Dirty fix - if term starts on Sunday, then set it to start on Monday
          if (startDate.getDay() == 0)
            startDate.setDate(startDate.getDate() + 1);

          // Dirty fix - if term starts on Tuesday, then set it to start on Monday
          if (startDate.getDay() == 2)
            startDate.setDate(startDate.getDate() - 1);

          let object = {
            term: term,
            start: startDate.toDateString(),
            end: endDate.toDateString(),
          };
          yearList.push(object);
        });
        keyDates[el.innerText] = yearList;
      });
      return keyDates;
    });

    await browser.close();
    return result;
  } catch (err) {
    // Close the browser so that there are no lingering instances
    await browser.close();
    console.log(Error(err));
    return Error(err);
  }
};

// Stolen from StackOverflow because I like the style
// https://stackoverflow.com/questions/3818193/how-to-add-number-of-days-to-todays-date
Date.prototype.addDays = function (days) {
  this.setDate(this.getDate() + parseInt(days));
  return this;
};

// Rudimentary method to convert week num + day to date
// NOTE: Only works if the key dates object starts terms on a Monday

// res = response object from scrapeKeyDates
// year = year as a string/number
// term = term as a number (summer term is 0, term 1 is 1, etc.)
// week = week number
// day = day as a string (eg. "Thu", "Thurs", "Thursday", etc.)
// option = option selected (0 for Date String or 1 for Formatted Date String, otherwise Date object)
let weekToDate = async (res, year, term, week, day, option) => {
  week -= 1; // Handle week number being 1-indexed
  day = day.substr(0, 3); // Grab the start of the day just in case it isn't passed in correctly

  // Get start of term for reference
  let start = res[year.toString()][term]["start"];

  // Calculate target date
  let date = new Date(start);
  date.addDays(week * 7 + DAYS.indexOf(day));

  if (option == null) {
    return date;
  } else if (option == 0) {
    return date.toDateString();
  } else if (option == 1) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  } else {
    return date;
  }
};

// Rudimentary method to convert date to term + week num
// NOTE: Only works if the key dates object starts terms on a Monday

// res = response object from scrapeKeyDates
// date = Date Object for the date being converted
let dateToWeek = (res, date) => {
  let target = date;

  // Loop through array of term start dates to determine
  // which term we're in and the start date of that term
  let curr = new Date(Date.parse(res[target.getFullYear()][0]["start"]));
  let prev = curr;

  let i = 0;
  while (curr <= target) {
    i++;
    prev = curr;
    if (i == res[target.getFullYear()].length) break;
    curr = new Date(Date.parse(res[target.getFullYear()][i]["start"]));
  }

  // Calculate week number
  let daysRaw = target - prev;
  let days = Math.ceil(daysRaw / (1000 * 60 * 60 * 24));
  let weeks = Math.ceil(days / 7) + 1;

  // Output
  return {
    term: TERMS[res[target.getFullYear()][i - 1]["term"]],
    week: weeks,
    day: DAYS[target.getDay()],
  };
};

// EXPORTS
exports.scrapeKeyDates = scrapeKeyDates;
exports.weekToDate = weekToDate;
exports.dateToWeek = dateToWeek;
