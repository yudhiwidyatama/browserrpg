const { weapons } = require("../content.cjs");
function renderShopControls(container, shop) {
  const buttons = (shop?.stock ?? []).map(({ weaponId, priceInCoins }) => {
    const weapon = weapons[weaponId];
    const button = container.ownerDocument.createElement("button");
    button.dataset.act = `buy:${weaponId}`;
    button.textContent = `${weapon.name} (+${weapon.attackBonus}) · ${priceInCoins} coins`;
    return button;
  });
  container.replaceChildren(...buttons);
}
module.exports = { renderShopControls };
