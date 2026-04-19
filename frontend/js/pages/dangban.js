// ============================================
// DANG BAN PAGE
// File: frontend/js/pages/dangban.js
// ============================================

window.pageInit = async function() {
    const form = document.getElementById('product-form');
    const mainImageInput = document.getElementById('main-image');
    const demoMediaInput = document.getElementById('demo-media');
    const previewContainer = document.getElementById('product-upload-previews');
    const mainLabel = document.getElementById('main-image-label');
    const demoLabel = document.getElementById('demo-media-label');

    let mainImage = null;
    let demoImages = [];
    let nextAttachmentId = 0;

    await loadCategories();
    initFilePickers();
    syncMainLabel();
    syncDemoLabel();

    bindClipboardImagePaste(form, handleClipboardImages, {
        onError: (error) => {
            showToast(error?.message || 'Không thể upload ảnh từ clipboard', 'error');
        }
    });

    mainImageInput.addEventListener('change', () => {
        const nextFile = mainImageInput.files && mainImageInput.files[0] ? mainImageInput.files[0] : null;
        replaceMainImage(nextFile ? createAttachment(nextFile, { source: 'local', status: 'ready' }) : null);
        syncMainLabel();
        renderPreviews();
    });

    demoMediaInput.addEventListener('change', () => {
        replaceLocalDemoImages(Array.from(demoMediaInput.files || []));
        syncDemoLabel();
        renderPreviews();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = form.title.value.trim();
        const price = parseFloat(form.price.value);
        const description = form.description.value.trim();
        const category_ids = Array.from(form.category_ids.selectedOptions).map(opt => parseInt(opt.value, 10));
        const download_url = form.download_url.value.trim();
        const demo_url = form.demo_url.value.trim();
        const video_url_input = form.video_url ? form.video_url.value.trim() : '';

        if (!title || !description || !download_url || !category_ids.length || Number.isNaN(price)) {
            showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
            return;
        }

        if (!mainImage) {
            showToast('Vui lòng chọn ảnh đại diện sản phẩm', 'error');
            return;
        }

        if (!demoImages.length && !demo_url && !video_url_input) {
            showToast('Vui lòng chọn ảnh demo hoặc nhập link demo/video', 'error');
            return;
        }

        if (hasPendingUploads()) {
            showToast('Ảnh từ clipboard đang upload, vui lòng đợi', 'warning');
            return;
        }

        try {
            let main_image = null;

            if (mainImage.source === 'uploaded' && mainImage.url) {
                main_image = mainImage.url;
            } else {
                if (!mainImage.file?.type?.startsWith('image/')) {
                    showToast('Ảnh đại diện phải là file ảnh', 'error');
                    return;
                }

                const mainCard = previewContainer.querySelector(`[data-kind="main"][data-id="${mainImage.id}"]`);
                const mainProgress = mainCard ? mainCard.querySelector('.upload-progress-bar') : null;
                const mainText = mainCard ? mainCard.querySelector('.upload-progress-text') : null;

                const mainFd = new FormData();
                mainFd.append('file', mainImage.file);
                const mainUpload = await api.uploadWithProgress('/uploads', mainFd, (percent) => {
                    if (mainProgress) mainProgress.style.width = `${percent}%`;
                    if (mainText) mainText.textContent = `${percent}%`;
                });

                if (!mainUpload.success) {
                    throw new Error('Không thể upload ảnh đại diện');
                }

                main_image = mainUpload.data.url;
            }

            const video_url = video_url_input || null;
            const gallery = demoImages
                .filter(item => item.source === 'uploaded' && item.url)
                .map(item => item.url);

            for (let i = 0; i < demoImages.length; i++) {
                const item = demoImages[i];
                if (item.source === 'uploaded') {
                    continue;
                }

                if (!item.file?.type?.startsWith('image/')) {
                    showToast('Ảnh demo phải là file ảnh', 'error');
                    return;
                }

                const card = previewContainer.querySelector(`[data-kind="demo"][data-id="${item.id}"]`);
                const bar = card ? card.querySelector('.upload-progress-bar') : null;
                const text = card ? card.querySelector('.upload-progress-text') : null;

                const fd = new FormData();
                fd.append('file', item.file);
                const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                    if (bar) bar.style.width = `${percent}%`;
                    if (text) text.textContent = `${percent}%`;
                });

                if (upload.success) {
                    gallery.push(upload.data.url);
                }
            }

            const payload = {
                title,
                slug: createSlug(title),
                price,
                category_id: category_ids[0],
                category_ids,
                description,
                main_image,
                video_url,
                demo_url: demo_url || null,
                download_url
            };

            if (gallery.length) payload.gallery = gallery;

            const response = await api.post('/products', payload);
            if (response.success) {
                showToast('Đăng sản phẩm thành công', 'success');
                form.reset();
                clearMainImage();
                clearDemoImages();
                syncMainLabel();
                syncDemoLabel();
                renderPreviews();
            }
        } catch (error) {
            showToast(error.message || 'Không thể đăng sản phẩm', 'error');
        }
    });

    async function handleClipboardImages(images) {
        if (!images.length) {
            return;
        }

        const uploadQueue = [];
        const originalCount = images.length;
        let assignedMainFromClipboard = false;

        if (!mainImage) {
            const mainAttachment = createAttachment(images[0], { source: 'uploaded', status: 'uploading' });
            replaceMainImage(mainAttachment);
            uploadQueue.push(mainAttachment);
            images = images.slice(1);
            assignedMainFromClipboard = true;
        }

        const demoAttachments = images.map(file => createAttachment(file, { source: 'uploaded', status: 'uploading' }));
        if (demoAttachments.length) {
            demoImages = [...demoImages, ...demoAttachments];
            uploadQueue.push(...demoAttachments);
        }

        syncMainLabel();
        syncDemoLabel();
        renderPreviews();

        let successCount = 0;
        let firstErrorMessage = '';

        for (const attachment of uploadQueue) {
            try {
                const didUpload = await uploadClipboardAttachment(attachment);
                if (didUpload) {
                    successCount += 1;
                }
            } catch (error) {
                firstErrorMessage = firstErrorMessage || error.message || 'Không thể upload ảnh từ clipboard';
                removeAttachment(attachment);
            }
        }

        syncMainLabel();
        syncDemoLabel();
        renderPreviews();

        if (successCount > 0) {
            if (assignedMainFromClipboard && originalCount > 1 && successCount === originalCount) {
                showToast('Ảnh đầu tiên được gán làm ảnh đại diện, các ảnh còn lại vào demo', 'success');
            } else {
                showToast(
                    successCount > 1 ? `Đã thêm ${successCount} ảnh từ clipboard` : 'Đã thêm ảnh từ clipboard',
                    'success'
                );
            }
        }

        if (firstErrorMessage) {
            throw new Error(firstErrorMessage);
        }
    }

    async function uploadClipboardAttachment(attachment) {
        const fd = new FormData();
        fd.append('file', attachment.file);

        let upload;
        try {
            upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                if (!hasAttachment(attachment)) {
                    return;
                }

                attachment.progress = percent;
                renderPreviews();
            });
        } catch (error) {
            if (!hasAttachment(attachment)) {
                return false;
            }
            throw error;
        }

        if (!upload.success) {
            throw new Error('Không thể upload ảnh từ clipboard');
        }

        if (!hasAttachment(attachment)) {
            return false;
        }

        attachment.progress = 100;
        attachment.status = 'uploaded';
        attachment.url = upload.data.url;
        renderPreviews();
        return true;
    }

    function createAttachment(file, { source = 'local', status = 'ready' } = {}) {
        return {
            id: `product-attachment-${Date.now()}-${++nextAttachmentId}`,
            file,
            previewUrl: URL.createObjectURL(file),
            url: '',
            source,
            status,
            progress: status === 'uploaded' ? 100 : 0
        };
    }

    function replaceMainImage(nextAttachment) {
        if (mainImage && mainImage !== nextAttachment) {
            releaseAttachment(mainImage);
        }
        mainImage = nextAttachment;
    }

    function clearMainImage() {
        replaceMainImage(null);
    }

    function replaceLocalDemoImages(files) {
        const preservedUploads = demoImages.filter(item => item.source === 'uploaded');
        demoImages
            .filter(item => item.source !== 'uploaded')
            .forEach(releaseAttachment);

        demoImages = [
            ...preservedUploads,
            ...files.map(file => createAttachment(file, { source: 'local', status: 'ready' }))
        ];
    }

    function clearDemoImages() {
        demoImages.forEach(releaseAttachment);
        demoImages = [];
    }

    function removeDemoImage(id) {
        const target = demoImages.find(item => item.id === id);
        if (target) {
            releaseAttachment(target);
        }
        demoImages = demoImages.filter(item => item.id !== id);
    }

    function removeAttachment(attachment) {
        if (!attachment) {
            return;
        }

        if (mainImage && mainImage.id === attachment.id) {
            clearMainImage();
            return;
        }

        removeDemoImage(attachment.id);
    }

    function hasAttachment(attachment) {
        if (!attachment) {
            return false;
        }

        return (mainImage && mainImage.id === attachment.id)
            || demoImages.some(item => item.id === attachment.id);
    }

    async function loadCategories() {
        const response = await api.get('/categories');
        const select = document.getElementById('category-select');
        select.innerHTML = (response.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    function renderPreviews() {
        if (!previewContainer) return;
        const items = [];

        if (mainImage) {
            items.push(renderPreviewCard(mainImage, 'Ảnh đại diện', 'main'));
        }

        demoImages.forEach((attachment, idx) => {
            items.push(renderPreviewCard(attachment, `Ảnh demo ${idx + 1}`, 'demo'));
        });

        previewContainer.innerHTML = items.join('');

        previewContainer.querySelectorAll('.upload-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const kind = btn.dataset.kind;
                const id = btn.dataset.id;
                if (kind === 'main') {
                    clearMainImage();
                    mainImageInput.value = '';
                    syncMainLabel();
                } else if (kind === 'demo') {
                    removeDemoImage(id);
                    demoMediaInput.value = '';
                    syncDemoLabel();
                }
                renderPreviews();
            });
        });
    }

    function renderPreviewCard(attachment, label, kind) {
        const url = attachment.url || attachment.previewUrl;
        const progress = attachment.status === 'uploading' ? attachment.progress : (attachment.source === 'uploaded' ? 100 : 0);
        const progressText = attachment.status === 'uploading'
            ? `${progress}%`
            : (attachment.source === 'uploaded' ? 'Đã upload' : '0%');

        return `
            <div class="upload-preview-item" data-kind="${kind}" data-id="${attachment.id}">
                <img src="${url}" class="upload-preview-img" alt="${label}">
                <button type="button" class="upload-remove" data-kind="${kind}" data-id="${attachment.id}" aria-label="Xóa">×</button>
                <div class="upload-progress">
                    <div class="upload-progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div>
                </div>
                <div class="upload-progress-text">${progressText}</div>
            </div>
        `;
    }

    function syncMainLabel() {
        if (!mainLabel) return;

        if (!mainImage) {
            mainLabel.textContent = 'Chưa chọn file';
            return;
        }

        if (mainImage.source === 'uploaded') {
            mainLabel.textContent = mainImage.status === 'uploading'
                ? 'Đang upload ảnh từ clipboard...'
                : 'Ảnh từ clipboard';
            return;
        }

        mainLabel.textContent = mainImage.file?.name || 'Chưa chọn file';
    }

    function syncDemoLabel() {
        if (!demoLabel) return;

        const total = demoImages.length;
        if (!total) {
            demoLabel.textContent = 'Chưa chọn file';
            return;
        }

        const clipboardCount = demoImages.filter(item => item.source === 'uploaded').length;
        const localCount = total - clipboardCount;

        if (localCount && clipboardCount) {
            demoLabel.textContent = `${total} ảnh (${localCount} chọn, ${clipboardCount} dán)`;
            return;
        }

        if (clipboardCount) {
            demoLabel.textContent = clipboardCount === 1 ? '1 ảnh từ clipboard' : `${clipboardCount} ảnh từ clipboard`;
            return;
        }

        if (localCount > 1) {
            demoLabel.textContent = `Đã chọn ${localCount} file`;
            return;
        }

        demoLabel.textContent = demoImages[0]?.file?.name || 'Chưa chọn file';
    }

    function hasPendingUploads() {
        return (mainImage && mainImage.status === 'uploading')
            || demoImages.some(item => item.status === 'uploading');
    }

    function releaseAttachment(attachment) {
        if (!attachment?.previewUrl || !attachment.previewUrl.startsWith('blob:')) {
            return;
        }

        URL.revokeObjectURL(attachment.previewUrl);
    }
};
