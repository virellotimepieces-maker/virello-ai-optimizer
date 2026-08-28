"use client";

import { useCallback, useEffect, useState } from "react";

type WooProduct = {
  id: number;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  status?: string;
  permalink?: string;
};

type ProductsResponse = {
  success?: boolean;
  connected?: boolean;
  platform?: string;
  storeUrl?: string;
  products?: WooProduct[];
  pagination?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
  error?: string;
};

export default function WooCommerceProductsPage() {
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [storeUrl, setStoreUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [editingId, setEditingId] = useState<number | null>(
    null
  );

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] =
    useState("");
  const [draftShortDescription, setDraftShortDescription] =
    useState("");

  const loadProducts = useCallback(
    async (requestedPage: number) => {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch(
          `/api/woocommerce/products?page=${requestedPage}&perPage=20`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const data =
          (await response.json().catch(() => null)) as
            | ProductsResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.error ||
              `Unable to load WooCommerce products (${response.status}).`
          );
        }

        if (
          data?.success !== true ||
          data?.connected !== true ||
          data?.platform !== "woocommerce"
        ) {
          throw new Error(
            data?.error ||
              "WooCommerce store is not connected."
          );
        }

        setProducts(
          Array.isArray(data.products)
            ? data.products
            : []
        );

        setStoreUrl(
          data.storeUrl || ""
        );

        const returnedTotalPages =
          Number(
            data.pagination?.totalPages
          ) || 1;

        setTotalPages(
          Math.max(1, returnedTotalPages)
        );

        setPage(
          Number(
            data.pagination?.page
          ) || requestedPage
        );
      } catch (err) {
        console.error(
          "WOOCOMMERCE_PRODUCTS_PAGE_ERROR:",
          err
        );

        setProducts([]);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load WooCommerce products."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  function startEditing(product: WooProduct) {
    setEditingId(product.id);

    setDraftName(
      product.name || ""
    );

    setDraftDescription(
      product.description || ""
    );

    setDraftShortDescription(
      product.short_description || ""
    );

    setMessage("");
    setError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftName("");
    setDraftDescription("");
    setDraftShortDescription("");
  }

  async function saveProduct(
    productId: number
  ) {
    if (savingId !== null) {
      return;
    }

    if (!draftName.trim()) {
      setError(
        "Product name cannot be empty."
      );
      return;
    }

    setSavingId(productId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/woocommerce/products/update",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            productId,
            name: draftName.trim(),
            description:
              draftDescription,
            shortDescription:
              draftShortDescription,
          }),
        }
      );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Unable to update product (${response.status}).`
        );
      }

      if (
        data?.success !== true ||
        data?.updated !== true ||
        data?.platform !== "woocommerce"
      ) {
        throw new Error(
          data?.error ||
            "WooCommerce product could not be updated."
        );
      }

      setMessage(
        "Product updated successfully."
      );

      cancelEditing();

      await loadProducts(page);
    } catch (err) {
      console.error(
        "WOOCOMMERCE_PRODUCT_SAVE_ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update WooCommerce product."
      );
    } finally {
      setSavingId(null);
    }
  }

  function goToPage(
    nextPage: number
  ) {
    if (
      nextPage < 1 ||
      nextPage > totalPages ||
      loading
    ) {
      return;
    }

    cancelEditing();
    loadProducts(nextPage);
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <div className="brand-small">
            VIRELLO AI
          </div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>
        </div>

        <div className="platform-pill">
          WooCommerce
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">
            WOOCOMMERCE PRODUCTS
          </div>

          <h1>
            Manage your{" "}
            <span>store listings.</span>
          </h1>

          <p>
            View your WooCommerce products
            and update approved product
            content directly from Virello.
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-inner">
          <div className="toolbar">
            <div>
              <div className="section-label">
                CONNECTED STORE
              </div>

              <strong>
                {storeUrl || "WooCommerce"}
              </strong>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() =>
                loadProducts(page)
              }
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : "Refresh products"}
            </button>
          </div>

          {error && (
            <div className="message error">
              {error}
            </div>
          )}

          {message && (
            <div className="message success">
              {message}
            </div>
          )}

          <section className="content-card">
            <div className="card-header">
              <div>
                <div className="section-label">
                  PRODUCT CATALOG
                </div>

                <h2>
                  WooCommerce products
                </h2>

                <p>
                  Select a product to edit
                  its content.
                </p>
              </div>

              <div className="page-indicator">
                Page {page} of{" "}
                {totalPages}
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-dot">
                  Loading
                </div>

                <p>
                  Loading your WooCommerce
                  products...
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">
                  No products found
                </div>

                <p>
                  No WooCommerce products
                  were returned for this
                  page.
                </p>
              </div>
            ) : (
              <div className="product-list">
                {products.map(
                  (product) => {
                    const isEditing =
                      editingId ===
                      product.id;

                    const isSaving =
                      savingId ===
                      product.id;

                    return (
                      <article
                        key={product.id}
                        className="product-card"
                      >
                        <div className="product-top">
                          <div>
                            <div className="product-id">
                              PRODUCT #
                              {product.id}
                            </div>

                            {!isEditing ? (
                              <h3>
                                {product.name ||
                                  "Untitled product"}
                              </h3>
                            ) : (
                              <input
                                className="edit-input title-input"
                                value={
                                  draftName
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDraftName(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                              />
                            )}
                          </div>

                          <div className="product-meta">
                            {product.status && (
                              <span className="status-pill">
                                {
                                  product.status
                                }
                              </span>
                            )}

                            {product.sku && (
                              <span>
                                SKU:{" "}
                                {
                                  product.sku
                                }
                              </span>
                            )}
                          </div>
                        </div>

                        {!isEditing ? (
                          <>
                            <p className="product-description">
                              {product.short_description
                                ? stripHtml(
                                    product.short_description
                                  )
                                : product.description
                                ? stripHtml(
                                    product.description
                                  )
                                : "No product description."}
                            </p>

                            <div className="product-footer">
                              <div className="price">
                                {product.price
                                  ? `$${product.price}`
                                  : "No price"}
                              </div>

                              <div className="product-actions">
                                {product.permalink && (
                                  <a
                                    href={
                                      product.permalink
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="view-link"
                                  >
                                    View product
                                  </a>
                                )}

                                <button
                                  type="button"
                                  className="edit-button"
                                  onClick={() =>
                                    startEditing(
                                      product
                                    )
                                  }
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="editor">
                            <div className="form-group">
                              <label>
                                Product description
                              </label>

                              <textarea
                                value={
                                  draftDescription
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDraftDescription(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                rows={8}
                              />
                            </div>

                            <div className="form-group">
                              <label>
                                Short description
                              </label>

                              <textarea
                                value={
                                  draftShortDescription
                                }
                                onChange={(
                                  event
                                ) =>
                                  setDraftShortDescription(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                rows={5}
                              />
                            </div>

                            <div className="editor-actions">
                              <button
                                type="button"
                                className="cancel-button"
                                onClick={
                                  cancelEditing
                                }
                                disabled={
                                  isSaving
                                }
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                className="save-button"
                                onClick={() =>
                                  saveProduct(
                                    product.id
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                              >
                                {isSaving
                                  ? "Saving..."
                                  : "Save to WooCommerce"}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }
                )}
              </div>
            )}

            <div className="pagination">
              <button
                type="button"
                onClick={() =>
                  goToPage(page - 1)
                }
                disabled={
                  loading ||
                  page <= 1
                }
              >
                ← Previous
              </button>

              <span>
                {page} /{" "}
                {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  goToPage(page + 1)
                }
                disabled={
                  loading ||
                  page >= totalPages
                }
              >
                Next →
              </button>
            </div>
          </section>
        </div>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

function stripHtml(
  value: string
): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page-shell {
    min-height: 100vh;
    background: #f4f5f7;
    color: #111318;
  }

  .topbar {
    min-height: 92px;
    padding: 18px 28px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .brand-small {
    color: #969ba3;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }

  .brand-name {
    margin-top: 5px;
    font-size: 20px;
    font-weight: 850;
  }

  .platform-pill {
    padding: 10px 15px;
    border: 1px solid #e0e3e7;
    border-radius: 999px;
    background: #ffffff;
    color: #6f757d;
    font-size: 11px;
    font-weight: 750;
  }

  .hero {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
  }

  .hero-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 60px 28px 55px;
  }

  .eyebrow,
  .section-label {
    color: #8c929a;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 0.16em;
  }

  .hero h1 {
    max-width: 850px;
    margin: 18px 0;
    font-size: clamp(42px, 7vw, 72px);
    line-height: 0.98;
    letter-spacing: -0.055em;
    font-weight: 900;
  }

  .hero h1 span {
    color: #949aa2;
  }

  .hero p {
    max-width: 760px;
    margin: 0;
    color: #727880;
    font-size: 18px;
    line-height: 1.65;
  }

  .workspace {
    padding: 28px;
  }

  .workspace-inner {
    max-width: 1100px;
    margin: 0 auto;
  }

  .toolbar {
    margin-bottom: 18px;
    padding: 20px 24px;
    border: 1px solid #e0e3e7;
    border-radius: 18px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .toolbar strong {
    display: block;
    margin-top: 7px;
    font-size: 15px;
    word-break: break-word;
  }

  .refresh-button,
  .edit-button,
  .save-button,
  .cancel-button,
  .pagination button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
  }

  .refresh-button {
    border: 1px solid #d9dce0;
    background: #ffffff;
    color: #111318;
  }

  .refresh-button:disabled,
  .edit-button:disabled,
  .save-button:disabled,
  .cancel-button:disabled,
  .pagination button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .message {
    margin-bottom: 18px;
    padding: 15px 18px;
    border: 1px solid #e0e3e7;
    border-radius: 12px;
    background: #ffffff;
    font-size: 14px;
    line-height: 1.5;
  }

  .message.error {
    color: #8a3030;
  }

  .message.success {
    color: #245c3a;
  }

  .content-card {
    padding: 30px;
    border: 1px solid #e0e3e7;
    border-radius: 22px;
    background: #ffffff;
    box-shadow:
      0 12px 30px
      rgba(17, 19, 24, 0.04);
  }

  .card-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e8eaed;
  }

  .card-header h2 {
    margin: 10px 0 6px;
    font-size: 30px;
    letter-spacing: -0.035em;
  }

  .card-header p {
    margin: 0;
    color: #7a8088;
    font-size: 14px;
  }

  .page-indicator {
    color: #81878f;
    font-size: 13px;
    font-weight: 750;
    white-space: nowrap;
  }

  .product-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 24px;
  }

  .product-card {
    padding: 22px;
    border: 1px solid #e0e3e7;
    border-radius: 17px;
    background: #fafafa;
  }

  .product-top {
    display: flex;
    justify-content: space-between;
    gap: 18px;
  }

  .product-id {
    margin-bottom: 7px;
    color: #92979e;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: 0.14em;
  }

  .product-card h3 {
    margin: 0;
    font-size: 19px;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  .product-meta {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    color: #858b93;
    font-size: 11px;
  }

  .status-pill {
    padding: 6px 9px;
    border: 1px solid #d9dce0;
    border-radius: 999px;
    background: #ffffff;
    color: #555b63;
    font-weight: 800;
    text-transform: capitalize;
  }

  .product-description {
    margin: 16px 0;
    color: #737981;
    font-size: 13px;
    line-height: 1.6;
  }

  .product-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
  }

  .price {
    font-size: 15px;
    font-weight: 850;
  }

  .product-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .view-link {
    color: #555b63;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
  }

  .edit-button {
    border: 0;
    background: #111318;
    color: #ffffff;
  }

  .edit-button:hover,
  .save-button:hover {
    background: #292d34;
  }

  .editor {
    margin-top: 18px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 7px;
    color: #30343a;
    font-size: 12px;
    font-weight: 800;
  }

  .edit-input,
  textarea {
    width: 100%;
    border: 1px solid #d9dce0;
    border-radius: 11px;
    background: #ffffff;
    color: #111318;
    outline: none;
    font-family: inherit;
  }

  .title-input {
    min-height: 48px;
    padding: 0 13px;
    font-size: 18px;
    font-weight: 750;
  }

  textarea {
    min-height: 110px;
    padding: 13px;
    resize: vertical;
    font-size: 14px;
    line-height: 1.55;
  }

  .edit-input:focus,
  textarea:focus {
    border-color: #111318;
    box-shadow:
      0 0 0 3px
      rgba(17, 19, 24, 0.08);
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .cancel-button {
    border: 1px solid #d9dce0;
    background: #ffffff;
    color: #111318;
  }

  .save-button {
    border: 0;
    background: #111318;
    color: #ffffff;
  }

  .empty-state {
    padding: 65px 20px;
    text-align: center;
  }

  .empty-title,
  .loading-dot {
    font-size: 17px;
    font-weight: 850;
  }

  .empty-state p {
    margin: 8px 0 0;
    color: #858b93;
    font-size: 14px;
  }

  .pagination {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #e8eaed;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .pagination button {
    border: 1px solid #d9dce0;
    background: #ffffff;
    color: #111318;
  }

  .pagination span {
    min-width: 65px;
    text-align: center;
    color: #6f757d;
    font-size: 13px;
    font-weight: 800;
  }

  @media (max-width: 700px) {
    .topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .hero-inner {
      padding: 50px 20px 45px;
    }

    .workspace {
      padding: 18px;
    }

    .content-card {
      padding: 20px;
    }

    .toolbar,
    .card-header,
    .product-top {
      align-items: flex-start;
      flex-direction: column;
    }

    .refresh-button {
      width: 100%;
    }

    .product-meta {
      justify-content: flex-start;
    }

    .product-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    .product-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .edit-button {
      flex: 1;
    }
  }

  @media (max-width: 520px) {
    .hero h1 {
      font-size: 46px;
    }

    .hero p {
      font-size: 16px;
    }

    .editor-actions {
      flex-direction: column;
    }

    .cancel-button,
    .save-button {
      width: 100%;
    }
  }
`;