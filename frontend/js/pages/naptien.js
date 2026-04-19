// ============================================
// NAP TIEN PAGE
// File: frontend/js/pages/naptien.js
// ============================================

window.pageInit = async function() {
    const form = document.getElementById('deposit-form');
    const list = document.getElementById('deposit-requests');
    const fileInput = document.getElementById('payment-proof');
    const previewContainer = document.getElementById('deposit-upload-previews');
    const fileLabel = document.getElementById('payment-proof-label');
    const paymentMethodSelect = document.getElementById('payment-method-select');
    const paymentMethodCustom = document.getElementById('payment-method-custom');

    let proofAttachment = null;
    let nextAttachmentId = 0;

    await loadRequests();
    await loadBankInfo();
    await refreshBalance();
    initFilePickers();
    initAmountChips();
    initPaymentMethodSelect();
    syncFileLabel();

    bindClipboardImagePaste(form, handleClipboardImages, {
        onError: (error) => {
            showToast(error?.message || 'Khong the upload anh tu clipboard', 'error');
        }
    });

    setInterval(async () => {
        await loadRequests();
        await refreshBalance();
    }, 30000);

    fileInput.addEventListener('change', () => {
        const nextFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        replaceProofAttachment(nextFile ? createAttachment(nextFile, { source: 'local', status: 'ready' }) : null);
        syncFileLabel();
        renderPreview();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = parseFloat(form.amount.value);
        const payment_method = resolvePaymentMethod();
        let payment_proof = null;

        if (!amount || amount <= 0) {
            showToast('So tien khong hop le', 'error');
            return;
        }

        if (!payment_method) {
            showToast('Vui long chon ngan hang hoac phuong thuc thanh toan', 'error');
            return;
        }

        if (proofAttachment?.status === 'uploading') {
            showToast('Anh tu clipboard dang upload, vui long doi', 'warning');
            return;
        }

        try {
            if (proofAttachment) {
                if (proofAttachment.source === 'uploaded' && proofAttachment.url) {
                    payment_proof = proofAttachment.url;
                } else if (!proofAttachment.file?.type?.startsWith('image/')) {
                    showToast('Anh chung tu phai la file anh', 'error');
                    return;
                } else {
                    const bar = previewContainer ? previewContainer.querySelector('.upload-progress-bar') : null;
                    const text = previewContainer ? previewContainer.querySelector('.upload-progress-text') : null;

                    const fd = new FormData();
                    fd.append('file', proofAttachment.file);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        payment_proof = upload.data.url;
                    }
                }
            }

            const response = await api.post('/wallet/deposit-request', {
                amount,
                payment_method,
                payment_proof
            });

            if (response.success) {
                showToast('Da gui yeu cau nap tien', 'success');
                form.reset();
                clearProofAttachment();
                syncFileLabel();
                renderPreview();
                await loadRequests();
                await refreshBalance();
            }
        } catch (error) {
            showToast(error.message || 'Khong the gui yeu cau', 'error');
        }
    });

    async function handleClipboardImages(images) {
        if (!images.length) {
            return;
        }

        if (images.length > 1) {
            showToast('Chi ho tro 1 anh chung tu, se lay anh dau tien', 'warning');
        }

        fileInput.value = '';
        const attachment = createAttachment(images[0], { source: 'uploaded', status: 'uploading' });
        replaceProofAttachment(attachment);
        syncFileLabel();
        renderPreview();

        const didUpload = await uploadClipboardAttachment(attachment);
        if (!didUpload) {
            return;
        }

        syncFileLabel();
        renderPreview();
        showToast('Da them anh tu clipboard', 'success');
    }

    async function uploadClipboardAttachment(attachment) {
        const fd = new FormData();
        fd.append('file', attachment.file);

        let upload;
        try {
            upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                if (proofAttachment !== attachment) {
                    return;
                }

                attachment.progress = percent;
                renderPreview();
            });
        } catch (error) {
            if (proofAttachment !== attachment) {
                return false;
            }
            throw error;
        }

        if (!upload.success) {
            throw new Error('Khong the upload anh tu clipboard');
        }

        if (proofAttachment !== attachment) {
            return false;
        }

        attachment.progress = 100;
        attachment.status = 'uploaded';
        attachment.url = upload.data.url;
        return true;
    }

    function createAttachment(file, { source = 'local', status = 'ready' } = {}) {
        return {
            id: `deposit-proof-${Date.now()}-${++nextAttachmentId}`,
            file,
            previewUrl: URL.createObjectURL(file),
            url: '',
            source,
            status,
            progress: status === 'uploaded' ? 100 : 0
        };
    }

    function replaceProofAttachment(nextAttachment) {
        if (proofAttachment && proofAttachment !== nextAttachment) {
            releaseAttachment(proofAttachment);
        }
        proofAttachment = nextAttachment;
    }

    function clearProofAttachment() {
        replaceProofAttachment(null);
    }

    function syncFileLabel() {
        if (!fileLabel) {
            return;
        }

        if (!proofAttachment) {
            fileLabel.textContent = 'Chua chon file';
            return;
        }

        if (proofAttachment.source === 'uploaded') {
            fileLabel.textContent = proofAttachment.status === 'uploading'
                ? 'Dang upload anh tu clipboard...'
                : 'Anh tu clipboard';
            return;
        }

        fileLabel.textContent = proofAttachment.file?.name || 'Chua chon file';
    }

    async function loadRequests() {
        try {
            const response = await api.get('/wallet/deposit-requests');
            if (response.success) {
                renderRequests(response.data);
            }
        } catch (error) {
            list.innerHTML = '<p>Khong the tai danh sach yeu cau</p>';
        }
    }

    async function loadBankInfo() {
        const section = document.getElementById('bank-info');
        if (!section) return;
        try {
            const response = await api.get('/settings', {
                keys: 'bank_qr_url,bank_name,bank_account_number,bank_account_name,bank_note'
            });
            if (!response.success) return;
            const data = response.data || {};

            if (!data.bank_name && !data.bank_account_number && !data.bank_account_name && !data.bank_qr_url) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            const qrImg = document.getElementById('bank-qr-image');
            const nameEl = document.getElementById('bank-name');
            const numberEl = document.getElementById('bank-account-number');
            const ownerEl = document.getElementById('bank-account-name');
            const noteRow = document.getElementById('bank-note-row');
            const noteEl = document.getElementById('bank-note');

            if (qrImg) {
                qrImg.src = data.bank_qr_url || '';
                qrImg.style.display = data.bank_qr_url ? 'block' : 'none';
            }
            if (nameEl) nameEl.textContent = data.bank_name || '-';
            if (numberEl) numberEl.textContent = data.bank_account_number || '-';
            if (ownerEl) ownerEl.textContent = data.bank_account_name || '-';
            if (noteEl) noteEl.textContent = data.bank_note || '';
            if (noteRow) noteRow.style.display = data.bank_note ? 'block' : 'none';
        } catch (error) {
            section.style.display = 'none';
        }
    }

    async function refreshBalance() {
        if (!Auth.isAuthenticated()) return;
        try {
            const response = await api.get('/auth/me');
            if (response.success) {
                Auth.saveAuth(localStorage.getItem('token'), response.data);
                const userSection = document.getElementById('user-section');
                if (userSection) {
                    const app = window.appInstance;
                    if (app && typeof app.updateUserSection === 'function') {
                        app.updateUserSection();
                    }
                }
            }
        } catch (error) {
            // ignore
        }
    }

    function renderRequests(items) {
        if (!items.length) {
            list.innerHTML = '<p>Chua co yeu cau nap tien.</p>';
            return;
        }

        const statusLabel = (status) => {
            if (status === 'approved') return '<span class="badge badge-success">Da duyet</span>';
            if (status === 'rejected') return '<span class="badge badge-danger">Tu choi</span>';
            return '<span class="badge badge-warning">Cho duyet</span>';
        };

        list.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>So tien</th>
                        <th>Phuong thuc</th>
                        <th>Trang thai</th>
                        <th>Ngay tao</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${formatMoney(item.amount)}</td>
                            <td>${item.payment_method || '-'}</td>
                            <td>${statusLabel(item.status)}</td>
                            <td>${formatDateShort(item.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderPreview() {
        if (!previewContainer) return;
        if (!proofAttachment) {
            previewContainer.innerHTML = '';
            return;
        }

        const previewUrl = proofAttachment.url || proofAttachment.previewUrl;
        const progress = proofAttachment.status === 'uploading'
            ? proofAttachment.progress
            : (proofAttachment.source === 'uploaded' ? 100 : 0);
        const progressText = proofAttachment.status === 'uploading'
            ? `${progress}%`
            : (proofAttachment.source === 'uploaded' ? 'Da upload' : '0%');

        previewContainer.innerHTML = `
            <div class="upload-preview-item">
                <img src="${previewUrl}" class="upload-preview-img" alt="preview">
                <button type="button" class="upload-remove" aria-label="Xoa">x</button>
                <div class="upload-progress">
                    <div class="upload-progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div>
                </div>
                <div class="upload-progress-text">${progressText}</div>
            </div>
        `;

        const btn = previewContainer.querySelector('.upload-remove');
        if (btn) {
            btn.addEventListener('click', () => {
                clearProofAttachment();
                fileInput.value = '';
                syncFileLabel();
                renderPreview();
            });
        }
    }

    function initAmountChips() {
        if (!form) return;
        const amountInput = form.amount;
        if (!amountInput) return;

        const chips = Array.from(document.querySelectorAll('.chip-amount'));
        if (!chips.length) return;

        chips.forEach((chip) => {
            chip.addEventListener('click', () => {
                const value = chip.getAttribute('data-amount') || '';
                if (value) {
                    amountInput.value = value;
                    amountInput.focus();
                }
                chips.forEach(c => c.classList.toggle('is-active', c === chip));
            });
        });
    }

    function initPaymentMethodSelect() {
        if (!paymentMethodSelect || !paymentMethodCustom) return;

        const toggleCustomInput = () => {
            const isCustom = paymentMethodSelect.value === 'Khac';
            paymentMethodCustom.style.display = isCustom ? 'block' : 'none';
            paymentMethodCustom.required = isCustom;
            if (!isCustom) {
                paymentMethodCustom.value = '';
            }
        };

        paymentMethodSelect.addEventListener('change', toggleCustomInput);
        toggleCustomInput();
    }

    function resolvePaymentMethod() {
        const selected = paymentMethodSelect?.value || '';
        if (selected === 'Khac') {
            return (paymentMethodCustom?.value || '').trim();
        }
        return selected.trim();
    }

    function releaseAttachment(attachment) {
        if (!attachment?.previewUrl || !attachment.previewUrl.startsWith('blob:')) {
            return;
        }

        URL.revokeObjectURL(attachment.previewUrl);
    }
};
