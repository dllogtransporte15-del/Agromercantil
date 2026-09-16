import { supabase } from './supabase.js';

async function test() {
  try {
    const { data, error } = await supabase.from('freight_offers').select('id, history').limit(1);
    if (error) {
      console.error('Error fetching:', error);
    } else {
      console.log('Success, history column exists:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}
test();
