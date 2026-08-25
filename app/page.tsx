async function optimize() {
  // Product title only is required.
  // All other product information is optional.
  if (!title.trim()) {
    setError("Enter a product title first.");
    return;
  }

  setLoading(true);
  setError("");
  setResult(null);

  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: {
          title: title.trim(),
          description: description.trim(),
          productType: productType.trim(),
          vendor: vendor.trim(),
          price: price.trim(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "AI optimization failed."
      );
    }

    setResult(data.result);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "AI optimization failed."
    );
  } finally {
    setLoading(false);
  }
}
