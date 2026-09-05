const { test, expect } = require('@playwright/test');

test('real pretrained vision model classifies a locally generated image', async ({ page }) => {
  test.setTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/labs/local-ai/');

  const output = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 224, 224);
    context.fillStyle = '#202124';
    context.fillRect(30, 50, 164, 124);
    context.fillStyle = '#ffffff';
    context.font = '28px Arial';
    context.fillText('TEST', 72, 120);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const client = new LocalAIClient({ modelTimeoutMs: 150000 });
    try {
      return await client.classifyImage(blob, { topK: 5, timeoutMs: 150000 });
    } finally {
      client.close();
    }
  });

  expect(output.model).toBe('onnx-community/mobilenetv4_conv_small.e2400_r224_in1k');
  expect(output.task).toBe('image-classification');
  expect(output.localOnly).toBe(true);
  expect(['webgpu', 'wasm']).toContain(output.backend);
  expect(output.predictions.length).toBeGreaterThanOrEqual(1);
  expect(output.predictions.length).toBeLessThanOrEqual(5);
  for (const prediction of output.predictions) {
    expect(typeof prediction.label).toBe('string');
    expect(Number.isFinite(prediction.score)).toBe(true);
    expect(prediction.score).toBeGreaterThanOrEqual(0);
    expect(prediction.score).toBeLessThanOrEqual(1);
  }
  expect(pageErrors).toEqual([]);
});
