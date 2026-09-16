import { fetchFreightOffers } from './lib/db';

async function test() {
  const offers = await fetchFreightOffers();
  console.log('Total offers:', offers.length);
  const found = offers.filter(o => 
    JSON.stringify(o).toLowerCase().includes('ijaci') || 
    JSON.stringify(o).toLowerCase().includes('calcario') ||
    o.totalTonnage === 28
  );
  console.log('Offers matching "ijaci" or "calcario" or "28":', JSON.stringify(found, null, 2));
}
test();
