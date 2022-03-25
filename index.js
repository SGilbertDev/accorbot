import chalk from "chalk";
import puppeteer from "puppeteer";
import enquirer from "enquirer";

const { Select, NumberPrompt, prompt } = enquirer;

(async () => {
  console.log(
    chalk.yellow.bold(
      "AUTOMATISATION DE RESERVATION DE PLACES POUR ACCOR ARENA"
    )
  );
  console.log(chalk.gray("CTRL+C pour arrêter le script"));
  console.log(" ");
  // Ask for event link
  const promptResponse = await prompt({
    type: "input",
    name: "link",
    message: "Lien de l'évènement",
  });

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(`${promptResponse.link}`);

  const titleElement = await page.waitForSelector(".titre-artiste h1"); // select the element
  const titleValue = await titleElement.evaluate((el) => el.textContent);
  console.log(chalk.gray("---------"));
  console.log(chalk.bold(titleValue));
  console.log(chalk.gray("---------"));

  // Try to book until successful
  const tryToBook = async (choosedCategoryIndex, numberOfTickets) => {
    await page.waitForTimeout(500);
    // Check for cookie banner again (can happen after a refresh)
    try {
      await page.waitForSelector("#onetrust-accept-btn-handler", {
        visible: true,
        timeout: 500,
      });
      await page.click("#onetrust-accept-btn-handler");
    } catch (e) {}
    await page.waitForTimeout(500);
    await page.addStyleTag({
      content: "#gridZonediv{display: block!important}",
    });
    const ticketsSelector = `#price-table tbody tr:nth-child(3) > td:nth-child(${
      choosedCategoryIndex + 1
    }) > select`;
    try {
      await page.waitForSelector(ticketsSelector, { timeout: 100 });
      await page.select(ticketsSelector, `${numberOfTickets}`);
      await page.click(".submitButton");
      await page.waitForTimeout(2000);
      const pageUrl = await page.url();

      // Check if in cart
      if (pageUrl.includes("panier")) {
        console.log(
          chalk.green(
            numberOfTickets > 1
              ? `🔥 ${numberOfTickets} places ont été ajoutées au panier, valide les manuellement !`
              : `🔥 ${numberOfTickets} place a été ajoutée au panier, valide la manuellement !`
          )
        );
      } else {
        console.log(chalk.grey("Epuisé :( On réessaie..."));
        await page.waitForTimeout(2000);
        await page.goto(`${promptResponse.link}`);
        await tryToBook(choosedCategoryIndex, numberOfTickets);
      }
    } catch (error) {
      console.log(chalk.grey("Epuisé :( On réessaie..."));
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
      await tryToBook(choosedCategoryIndex, numberOfTickets);
    }
  };

  // Check for cookie banner then accept it
  if ((await page.$("#onetrust-button-group")) !== null) {
    await page.click("#onetrust-accept-btn-handler");
  }
  await page.waitForTimeout(500);

  // Force the display of reservation grid
  await page.addStyleTag({ content: "#gridZonediv{display: block!important}" });

  // Get all categories available for this event
  const categories = await page.$$eval(
    '#price-table tbody tr th[scope="col"]',
    (elements) => elements.map((item) => item.textContent)
  );

  // Ask for category wanted
  const promptCategory = new Select({
    name: "category",
    message: "Choisis une catégorie",
    choices: categories.filter((cat) => cat !== ""),
  });

  promptCategory
    .run()
    .then((choosedCategory) => {
      const promptNumber = new NumberPrompt({
        name: "number",
        message: "Combien de places ?",
      });
      const choosedCategoryIndex = categories.indexOf(choosedCategory);

      promptNumber
        .run()
        .then((numberOfTickets) => {
          console.log(" ");
          tryToBook(choosedCategoryIndex, numberOfTickets);
        })
        .catch(console.error);
    })
    .catch(console.error);
})();
