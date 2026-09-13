const {test,expect}=require('@playwright/test');
test('local workflow cleans text and downloads actual output without network',async({page})=>{
 await page.goto('/');
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.locator('#input').fill('  Hello   \nworld   ');
 await page.locator('#clean').click();
 await expect(page.locator('#output')).toHaveValue('Hello\nworld');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
 expect(download.suggestedFilename()).toBe('clean-text.txt');
 const stream=await download.createReadStream();let value='';for await(const chunk of stream)value+=chunk;
 expect(value).toBe('Hello\nworld'); expect(requests).toEqual([]);
});
test('empty state, docs and mobile layout',async({page})=>{
 await page.goto('/');await page.locator('#clean').click();await expect(page.locator('#download')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.getByRole('link',{name:'Handbook'}).click();await expect(page.locator('h1')).toHaveText('Handbook');
});
