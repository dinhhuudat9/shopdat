// ============================================
// ADMIN PAGE
// File: frontend/js/pages/admin.js
// ============================================

window.pageInit = async function(params, query = {}) {
    let logInterval = null;

    bindTabs(query.tab || 'dashboard');
    await loadDashboard();
    await loadUsers();
    await loadDeposits();
    await loadProducts();
    await loadCategories();
    await loadPosts();
    await loadMessages();
    await loadSupport();
    await loadNotifications();
    await loadInspect();
    await loadSecurity();
    await loadStorage();
    await loadLogs();
    initShareDataModal();
    await loadSettings();

    window.pageCleanup = () => {
        if (logInterval) clearInterval(logInterval);
    };

    function bindTabs(initialTab = 'dashboard') {
        const availableTabs = new Set([
            'dashboard',
            'users',
            'deposits',
            'products',
            'categories',
            'posts',
            'messages',
            'support',
            'notifications',
            'inspect',
            'security',
            'logs',
            'storage',
            'settings'
        ]);

        const normalizeTab = (tab) => availableTabs.has(tab) ? tab : 'dashboard';

        const syncTabUrl = (tab) => {
            const nextUrl = `/admin?tab=${encodeURIComponent(tab)}`;
            window.history.replaceState({}, '', nextUrl);
            window.appInstance?.refreshRouteAwareUi?.();
        };

        const showTab = (tab, { syncUrl = true } = {}) => {
            const nextTab = normalizeTab(tab);

            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(`tab-${nextTab}`);
            if (pane) pane.classList.add('active');

            if (syncUrl) {
                syncTabUrl(nextTab);
            }
        };

        const normalizedInitialTab = normalizeTab(initialTab);
        showTab(normalizedInitialTab, { syncUrl: normalizedInitialTab !== initialTab });
    }

    async function loadDashboard() {
        const container = document.getElementById('tab-dashboard');
        try {
            const response = await api.get('/admin/dashboard');
            if (response.success) {
                const d = response.data;
                const dailySeries = Array.isArray(d.dailyRevenue) ? d.dailyRevenue : [];
                const monthlySeries = Array.isArray(d.monthlyRevenue) ? d.monthlyRevenue : [];
                const dailyTotal = dailySeries.reduce((sum, item) => sum + (item.value || 0), 0);
                const monthlyTotal = monthlySeries.reduce((sum, item) => sum + (item.value || 0), 0);
                const system = d.systemStats || {};
                const mem = system.memory || {};
                const cpu = system.cpu || {};
                const load = system.load || {};
                const reqStats = d.requestStats || {};
                const load1m = Number(load['1m'] ?? (Array.isArray(load) ? load[0] : 0)) || 0;
                const load5m = Number(load['5m'] ?? (Array.isArray(load) ? load[1] : 0)) || 0;
                const load15m = Number(load['15m'] ?? (Array.isArray(load) ? load[2] : 0)) || 0;
                const reqTotal = reqStats.total ?? reqStats.buffered ?? 0;
                const reqLast1h = reqStats.last1h ?? 0;
                const reqLast5m = reqStats.last5m ?? 0;
                const cpuLoadPercent = Math.max(0, Math.min(100, Math.round((load1m / Math.max(cpu.cores || 1, 1)) * 100)));
                const reqLoadPercent = reqLast1h > 0 ? Math.max(0, Math.min(100, Math.round((reqLast5m / Math.max(reqLast1h, 1)) * 100))) : 0;

                container.innerHTML = `
                    <div class="stat-grid">
                        <div class="stat-card">Doanh thu (tổng): <strong>${formatMoney(d.totalRevenue)}</strong></div>
                        <div class="stat-card">Doanh thu 30 ngày: <strong>${formatMoney(dailyTotal)}</strong></div>
                        <div class="stat-card">Doanh thu 12 tháng: <strong>${formatMoney(monthlyTotal)}</strong></div>
                        <div class="stat-card">Tổng user: <strong>${d.totalUsers}</strong></div>
                        <div class="stat-card">User hoạt động: <strong>${d.activeUsers}</strong></div>
                        <div class="stat-card">Sản phẩm: <strong>${d.totalProducts}</strong></div>
                        <div class="stat-card">Dung lượng dữ liệu: <strong>${formatBytes(d.dbSizeBytes || 0)}</strong></div>
                    </div>
                    <div class="section-card section-spaced">
                        <div class="section-header">
                            <div>
                                <h3 class="section-title">Hệ thống</h3>
                                <p class="section-subtitle">RAM, CPU và lưu lượng request gần đây.</p>
                            </div>
                        </div>
                        <div class="donut-grid">
                            <div class="donut-card">
                                <div id="donut-ram" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title">RAM</div>
                                    <div class="donut-text">${formatBytes(mem.usedBytes || 0)} / ${formatBytes(mem.totalBytes || 0)}</div>
                                    <div class="donut-sub">Còn trống: ${formatBytes(mem.freeBytes || Math.max((mem.totalBytes || 0) - (mem.usedBytes || 0), 0))}</div>
                                </div>
                            </div>
                            <div class="donut-card">
                                <div id="donut-cpu" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title">CPU</div>
                                    <div class="donut-text">${cpu.model || 'Không rõ'}</div>
                                    <div class="donut-sub">${cpu.cores || 0} cores · Load 1m: ${load1m.toFixed(2)}</div>
                                </div>
                            </div>
                            <div class="donut-card">
                                <div id="donut-req" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title">Requests</div>
                                    <div class="donut-text">5p: ${reqLast5m} · 1h: ${reqLast1h}</div>
                                    <div class="donut-sub">Tổng uptime: ${reqTotal} · Buffer: ${reqStats.buffered ?? 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="chart-grid">
                        <div class="chart-card">
                            <div class="chart-header">
                                <div>
                                    <div class="chart-title">Doanh thu 30 ngày</div>
                                    <div class="chart-subtitle">Giao dịch purchase theo ngày</div>
                                </div>
                                <div class="chart-total">${formatMoney(dailyTotal)}</div>
                            </div>
                            <div id="chart-daily" class="line-chart"></div>
                        </div>
                        <div class="chart-card">
                            <div class="chart-header">
                                <div>
                                    <div class="chart-title">Doanh thu 12 tháng</div>
                                    <div class="chart-subtitle">Giao dịch purchase theo tháng</div>
                                </div>
                                <div class="chart-total">${formatMoney(monthlyTotal)}</div>
                            </div>
                            <div id="chart-monthly" class="line-chart"></div>
                        </div>
                    </div>
                    <div class="section-spaced">
                        <button id="reset-revenue" class="btn-primary">Reset doanh thu</button>
                    </div>
                    <div id="dashboard-security-shortcut"></div>
                `;
                document.getElementById('reset-revenue').addEventListener('click', async () => {
                    if (confirm('Reset doanh thu về 0?')) {
                        await api.post('/admin/revenue/reset');
                        await loadDashboard();
                    }
                });

                renderDonutChart(document.getElementById('donut-ram'), Math.max(0, Math.min(100, Math.round(mem.usedPercent || 0))), { from: '#22c55e', to: '#16a34a' });
                renderDonutChart(document.getElementById('donut-cpu'), cpuLoadPercent, { from: '#6366f1', to: '#7c3aed' });
                renderDonutChart(document.getElementById('donut-req'), reqLoadPercent, { from: '#f97316', to: '#fb923c' });

                renderComboChart(document.getElementById('chart-daily'), dailySeries, { maxPoints: 30, labelFormat: 'day' });
                renderComboChart(document.getElementById('chart-monthly'), monthlySeries, { maxPoints: 12, labelFormat: 'month' });
                await loadDashboardSecurityShortcut();
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải dashboard.</p>';
        }
    }

    async function loadDashboardSecurityShortcut() {
        const slot = document.getElementById('dashboard-security-shortcut');
        if (!slot) return;

        try {
            const response = await api.get('/admin/security-overview');
            if (!response.success) {
                throw new Error('Khong the tai thong tin bao mat');
            }

            const summary = response.data?.summary || {};
            slot.innerHTML = `
                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Bao mat</h3>
                            <p class="section-subtitle">Xem nhanh API bi chan va tai khoan dang khoa.</p>
                        </div>
                        <button id="dashboard-open-security" class="btn-outline">Mo trung tam bao mat</button>
                    </div>
                    <div class="stat-grid">
                        <div class="stat-card">API bi chan: <strong>${Number(summary.blockedApiEndpointCount || 0)}</strong></div>
                        <div class="stat-card">IP dang block: <strong>${Number(summary.blockedIpCount || 0)}</strong></div>
                        <div class="stat-card">Tai khoan dang khoa: <strong>${Number(summary.lockedAccountCount || 0)}</strong></div>
                    </div>
                </div>
            `;

            const openBtn = document.getElementById('dashboard-open-security');
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=security');
                });
            }
        } catch (error) {
            slot.innerHTML = '';
        }
    }

    async function loadUsers() {
        const container = document.getElementById('tab-users');
        try {
            const response = await api.get('/admin/users');
            if (response.success) {
                const userMap = new Map((response.data || []).map(user => [String(user.id), user]));
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Cộng/trừ tiền thủ công</h3>
                        <form id="adjust-form">
                            <input type="number" name="user_id" placeholder="User ID" required>
                            <input type="number" name="amount" placeholder="Amount (có thể âm)" required>
                            <input type="text" name="description" placeholder="Lý do">
                            <button type="submit" class="btn-primary">Cập nhật</button>
                        </form>
                    </div>
                    <table class="table"> 
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Email</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(user => `
                                <tr>
                                    <td>${user.id}</td>
                                    <td>${renderDisplayName(user, '-')}</td>
                                    <td>${user.email}</td>
                                    <td>
                                        <select data-role="${user.id}">
                                            ${['user','seller','admin'].map(r => `<option value="${r}" ${r===user.role?'selected':''}>${r}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <select data-status="${user.id}">
                                            ${['active','banned'].map(s => `<option value="${s}" ${s===user.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-delete="${user.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div id="inactive-users" class="section-card section-spaced"></div>
                `;

                const adjustForm = document.getElementById('adjust-form');
                adjustForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await api.post('/admin/balance/adjust', {
                        user_id: parseInt(adjustForm.user_id.value),
                        amount: parseFloat(adjustForm.amount.value),
                        description: adjustForm.description.value
                    });
                    showToast('Đã cập nhật số dư', 'success');
                    adjustForm.reset();
                });

                container.querySelectorAll('select[data-role]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/users/${sel.dataset.role}/role`, { role: sel.value });
                        showToast('Đã cập nhật vai trò', 'success');
                    });
                });
                container.querySelectorAll('select[data-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        try {
                            await api.put(`/admin/users/${sel.dataset.status}/status`, { status: sel.value });
                            showToast('Đã cập nhật trạng thái', 'success');
                        } catch (error) {
                            showToast(error.message || 'Không thể cập nhật trạng thái', 'error');
                            await loadUsers();
                        }
                    });
                });
                container.querySelectorAll('button[data-delete]').forEach(btn => {
                    const user = userMap.get(String(btn.dataset.delete));
                    if (user && btn.parentElement) {
                        const verifyBtn = document.createElement('button');
                        verifyBtn.type = 'button';
                        verifyBtn.className = 'btn-outline';
                        verifyBtn.textContent = user.is_verified ? 'Bo tich xanh' : 'Cap tich xanh';
                        verifyBtn.style.marginRight = '8px';
                        verifyBtn.addEventListener('click', async () => {
                            try {
                                await api.put(`/admin/users/${user.id}/verified`, {
                                    is_verified: !user.is_verified
                                });
                                showToast('Da cap nhat tich xanh', 'success');
                                await loadUsers();
                            } catch (error) {
                                showToast(error.message || 'Khong the cap nhat tich xanh', 'error');
                            }
                        });
                        btn.parentElement.insertBefore(verifyBtn, btn);
                    }
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa user?')) {
                            await api.delete(`/admin/users/${btn.dataset.delete}`);
                            await loadUsers();
                        }
                    });
                });

                await loadInactiveUsers();
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải user.</p>';
        }
    }

    async function loadInactiveUsers() {
        const container = document.getElementById('inactive-users');
        if (!container) return;
        try {
            const response = await api.get('/admin/users/inactive', { days: 30, limit: 100 });
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
                return;
            }
            const items = response.data || [];
            container.innerHTML = `
                <div class="section-header">
                    <div>
                        <h3 class="section-title">User off hơn 30 ngày</h3>
                        <p class="section-subtitle">Có thể xóa nếu không hoạt động trong 1 tháng.</p>
                    </div>
                    <button id="delete-inactive" class="btn-danger">Xóa tất cả</button>
                </div>
                ${items.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Email</th>
                                <th>Họ tên</th>
                                <th>Last login</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td>${u.email}</td>
                                    <td>${u.full_name || '-'}</td>
                                    <td>${u.last_login ? formatDateShort(u.last_login) : 'Chưa đăng nhập'}</td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-inactive-delete="${u.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>Không có user off quá 30 ngày.</p>'}
            `;

            const deleteAllBtn = document.getElementById('delete-inactive');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async () => {
                    if (!confirm('Xóa tất cả user off hơn 30 ngày?')) return;
                    await api.delete('/admin/users/inactive?days=30');
                    await loadUsers();
                });
            }

            container.querySelectorAll('button[data-inactive-delete]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Xóa user này?')) return;
                    await api.delete(`/admin/users/${btn.dataset.inactiveDelete}`);
                    await loadUsers();
                });
            });
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
        }
    }

    async function loadDeposits() {
        const container = document.getElementById('tab-deposits');
        try {
            const response = await api.get('/admin/deposit-requests');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Số tiền</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(r => `
                                <tr>
                                    <td>${r.id}</td>
                                    <td>${r.email}</td>
                                    <td>${formatMoney(r.amount)}</td>
                                    <td>${r.status}</td>
                                    <td>
                                        ${r.status === 'pending' ? `
                                            <button class="btn-primary" data-approve="${r.id}">Duyệt</button>
                                            <button class="btn-outline" data-reject="${r.id}">Từ chối</button>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                container.querySelectorAll('button[data-approve]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.approve}/approve`, { approve: true });
                        await loadDeposits();
                    });
                });
                container.querySelectorAll('button[data-reject]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.reject}/approve`, { approve: false });
                        await loadDeposits();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải yêu cầu nạp.</p>';
        }
    }

    async function loadProducts() {
        const container = document.getElementById('tab-products');
        try {
            const response = await api.get('/admin/products');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Seller</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${p.title}</td>
                                    <td>${p.seller_name}</td>
                                    <td>
                                        <select data-product-status="${p.id}">
                                            ${['active','inactive','banned'].map(s => `<option value="${s}" ${s===p.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-product-edit="${p.id}">Sửa</button>
                                        <button class="btn-ghost btn-danger" data-product-delete="${p.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('select[data-product-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/products/${sel.dataset.productStatus}/status`, { status: sel.value });
                        showToast('Đã cập nhật', 'success');
                    });
                });
                container.querySelectorAll('button[data-product-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa sản phẩm?')) {
                            await api.delete(`/admin/products/${btn.dataset.productDelete}`);
                            await loadProducts();
                        }
                    });
                });
                container.querySelectorAll('button[data-product-edit]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        router.navigate(`/suasanpham/${btn.dataset.productEdit}`);
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải sản phẩm.</p>';
        }
    }

    async function loadCategories() {
        const container = document.getElementById('tab-categories');
        try {
            const response = await api.get('/admin/categories');
            if (response.success) {
                const categories = response.data || [];
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Thêm danh mục</h3>
                        <form id="category-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên</label>
                                <input type="text" name="name" required>
                            </div>
                            <div class="form-group">
                                <label>Slug (tùy chọn)</label>
                                <input type="text" name="slug" placeholder="tu-dong-neu-bo-trong">
                            </div>
                            <div class="form-group">
                                <label>Icon (link ảnh hoặc FontAwesome)</label>
                                <input type="text" name="icon" placeholder="https://... hoặc fa-layer-group">
                            </div>
                            <div class="form-group">
                                <label>Thứ tự hiển thị</label>
                                <input type="number" name="display_order" value="0">
                            </div>
                            <div class="form-group full">
                                <label>Hoạt động</label>
                                <select name="is_active">
                                    <option value="1">Bật</option>
                                    <option value="0">Tắt</option>
                                </select>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Thêm danh mục</button>
                            </div>
                        </form>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Slug</th>
                                <th>Icon</th>
                                <th>Thứ tự</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categories.map(cat => `
                                <tr>
                                    <td>${cat.id}</td>
                                    <td><input type="text" value="${cat.name}" data-cat-name="${cat.id}"></td>
                                    <td><input type="text" value="${cat.slug}" data-cat-slug="${cat.id}"></td>
                                    <td><input type="text" value="${cat.icon || ''}" data-cat-icon="${cat.id}"></td>
                                    <td><input type="number" value="${cat.display_order || 0}" data-cat-order="${cat.id}"></td>
                                    <td>
                                        <select data-cat-active="${cat.id}">
                                            <option value="1" ${cat.is_active ? 'selected' : ''}>Bật</option>
                                            <option value="0" ${!cat.is_active ? 'selected' : ''}>Tắt</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-cat-save="${cat.id}">LÆ°u</button>
                                        <button class="btn-ghost btn-danger" data-cat-delete="${cat.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                const form = document.getElementById('category-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        name: form.name.value.trim(),
                        slug: form.slug.value.trim(),
                        icon: form.icon.value.trim(),
                        display_order: parseInt(form.display_order.value || '0', 10),
                        is_active: form.is_active.value === '1'
                    };
                    await api.post('/admin/categories', payload);
                    showToast('Đã thêm danh mục', 'success');
                    await loadCategories();
                });

                container.querySelectorAll('button[data-cat-save]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.catSave;
                        const payload = {
                            name: container.querySelector(`[data-cat-name="${id}"]`).value.trim(),
                            slug: container.querySelector(`[data-cat-slug="${id}"]`).value.trim(),
                            icon: container.querySelector(`[data-cat-icon="${id}"]`).value.trim(),
                            display_order: parseInt(container.querySelector(`[data-cat-order="${id}"]`).value || '0', 10),
                            is_active: container.querySelector(`[data-cat-active="${id}"]`).value === '1'
                        };
                        await api.put(`/admin/categories/${id}`, payload);
                        showToast('Đã cập nhật danh mục', 'success');
                    });
                });

                container.querySelectorAll('button[data-cat-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xóa danh mục?')) return;
                        await api.delete(`/admin/categories/${btn.dataset.catDelete}`);
                        await loadCategories();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh mục.</p>';
        }
    }

    async function loadPosts() {
        const container = document.getElementById('tab-posts');
        try {
            const response = await api.get('/admin/posts');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${p.full_name}</td>
                                    <td>${p.content.substring(0, 50)}...</td>
                                    <td>${formatDateShort(p.created_at)}</td>
                                    <td><button class="btn-ghost btn-danger" data-post-delete="${p.id}">Xóa</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('button[data-post-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa bài đăng?')) {
                            await api.delete(`/admin/posts/${btn.dataset.postDelete}`);
                            await loadPosts();
                        }
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải bài đăng.</p>';
        }
    }

    async function loadMessages() {
        const container = document.getElementById('tab-messages');
        try {
            const response = await api.get('/admin/messages');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Sender</th>
                                <th>Receiver</th>
                                <th>Action</th>
                                <th>Loại</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(m => `
                                <tr>
                                    <td>${m.id}</td>
                                    <td>${escapeHtml(m.sender_name || `User #${m.sender_id}`)}</td>
                                    <td>${escapeHtml(m.receiver_name || `User #${m.receiver_id}`)}</td>
                                    <td><button type="button" class="btn-ghost btn-danger" data-admin-message-delete="${m.id}">Xoa</button></td>
                                    <td>${escapeHtml(m.message_type || 'text')}</td>
                                    <td class="admin-message-content">${renderMessageBodyHtml(m)}</td>
                                    <td>${formatDateShort(m.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('button[data-admin-message-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xoa tin nhan nay?')) return;
                        try {
                            const resp = await api.delete(`/admin/messages/${btn.dataset.adminMessageDelete}`);
                            if (resp.success) {
                                showToast('Da xoa tin nhan', 'success');
                                await loadMessages();
                            }
                        } catch (deleteError) {
                            showToast(deleteError.message || 'Khong the xoa tin nhan', 'error');
                        }
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        }
    }

    async function loadSupport() {
        const container = document.getElementById('tab-support');
        try {
            const response = await api.get('/admin/support/threads');
            if (response.success) {
                container.innerHTML = `
                    <div class="admin-chat">
                        <div class="admin-chat-list">
                            ${response.data.map(item => `
                                <button class="admin-chat-item" data-user="${item.user_id}">
                                    <div class="admin-chat-name">${escapeHtml(item.full_name || item.email || `User #${item.user_id}`)}</div>
                                    <div class="admin-chat-preview">${escapeHtml(getMessagePreview(item, 90))}</div>
                                </button>
                            `).join('')}
                        </div>
                        <div class="admin-chat-thread">
                            <div id="admin-chat-messages" class="chat-messages"></div>
                            <form id="admin-chat-form" class="chat-input">
                                <input type="text" name="content" placeholder="Nhập phản hồi..." required>
                                <button type="submit" class="btn-primary">Gửi</button>
                            </form>
                        </div>
                    </div>
                `;

                const messageBox = document.getElementById('admin-chat-messages');
                const form = document.getElementById('admin-chat-form');
                let activeUserId = null;

                async function loadThread(userId) {
                    activeUserId = userId;
                    const res = await api.get(`/admin/support/thread/${userId}`);
                    if (res.success) {
                        const adminId = res.admin_id;
                        messageBox.innerHTML = (res.data || []).map(m => `
                            <div class="chat-bubble ${m.sender_id === adminId ? 'me' : 'admin'}">
                                <div class="chat-meta">${formatDateShort(m.created_at)}</div>
                                <div class="chat-text">${renderMessageBodyHtml(m)}</div>
                            </div>
                        `).join('');
                        messageBox.scrollTop = messageBox.scrollHeight;
                    }
                }

                container.querySelectorAll('.admin-chat-item').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        container.querySelectorAll('.admin-chat-item').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        await loadThread(btn.dataset.user);
                    });
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!activeUserId) return;
                    const content = form.content.value.trim();
                    if (!content) return;
                    await api.post(`/admin/support/thread/${activeUserId}`, { content });
                    form.content.value = '';
                    await loadThread(activeUserId);
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải hỗ trợ/tố cáo.</p>';
        }
    }

    async function loadNotifications() {
        const container = document.getElementById('tab-notifications');
        if (!container) return;
        try {
            const [usersRes, noticesRes] = await Promise.all([
                api.get('/admin/users', { limit: 200 }),
                api.get('/admin/notifications', { limit: 100 })
            ]);

            const users = usersRes.success ? usersRes.data : [];
            const notices = noticesRes.success ? noticesRes.data : [];

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tạo thông báo</h3>
                    <form id="notification-form" class="form-grid form-grid-2">
                        <div class="form-group">
                            <label>Tiêu đề</label>
                            <input type="text" name="title" required>
                        </div>
                        <div class="form-group full">
                            <label>Chọn người nhận</label>
                            <input type="text" id="notif-search" placeholder="Tìm kiếm theo email hoặc tên...">
                            <div id="notif-user-list" class="notif-user-list"></div>
                            <div class="notif-select-meta">
                                <small>Chọn nhiều tài khoản (không chọn sẽ gửi cho tất cả).</small>
                                <span id="notif-selected-count" class="badge badge-info">0 đã chọn</span>
                            </div>
                        </div>
                        <div class="form-group full">
                            <label>Ảnh thông báo (tùy chọn)</label>
                            <div class="file-picker">
                                <input type="file" id="notif-image" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="notif-image" data-file-label="notif-image-label">Chọn ảnh</button>
                                <span id="notif-image-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <div id="notif-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group full">
                            <label>Nội dung</label>
                            <textarea name="content" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="tos-checkbox">
                                <input type="checkbox" name="is_important">
                                <span>Thong bao quan trong (hien popup khi vao web)</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label>Dong tam (gio)</label>
                            <input type="number" name="dismiss_hours" min="1" max="168" value="2">
                        </div>
                        <div class="form-group full">
                            <button type="submit" class="btn-primary">Dang thong bao</button>
                        </div>
                    </form>
                </div>
                <div class="section-card">
                    <h3 class="section-title">Thông báo gần đây</h3>
                    ${notices.length ? `
                        <div class="notif-cards">
                            ${notices.map(n => `
                                <div class="notif-card">
                                    <div class="notif-card-header">
                                        <div>
                                            <div class="notif-card-title">${n.title}</div>
                                            <div class="notif-card-meta">${n.target_email || 'Tất cả'} • ${formatDateShort(n.created_at)}</div>
                                        </div>
                                        <div class="badge-row">
                                            ${Number(n.is_important || 0) === 1 ? '<div class="badge badge-warning">Quan trong</div>' : ''}
                                            <div class="badge badge-info">#${n.id}</div>
                                        </div>
                                    </div>
                                    ${n.image_url ? `<img src="${n.image_url}" class="notif-card-image" alt="notif">` : ''}
                                    ${n.content ? `<div class="notif-card-content">${n.content}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Chưa có thông báo.</p>'}
                </div>
            `;

            const form = document.getElementById('notification-form');
            const searchInput = document.getElementById('notif-search');
            const userList = document.getElementById('notif-user-list');
            const imageInput = document.getElementById('notif-image');
            const imageLabel = document.getElementById('notif-image-label');
            const imagePreview = document.getElementById('notif-preview');
            let imageFile = null;
            const selectedUserIds = new Set();
            const selectedCount = document.getElementById('notif-selected-count');

            const renderUserList = (filterText = '') => {
                const keyword = filterText.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const email = (u.email || '').toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    return !keyword || email.includes(keyword) || name.includes(keyword);
                });

                userList.innerHTML = filtered.length ? filtered.map(u => `
                    <label class="notif-user-item">
                        <input type="checkbox" name="notif_target" value="${u.id}" ${selectedUserIds.has(String(u.id)) ? 'checked' : ''}>
                        <div class="notif-user-info">
                            <div class="notif-user-email">${u.email}</div>
                            ${u.full_name ? `<div class="notif-user-name">${u.full_name}</div>` : ''}
                        </div>
                    </label>
                `).join('') : '<p>Không tìm thấy user.</p>';

                userList.querySelectorAll('input[name="notif_target"]').forEach(input => {
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            selectedUserIds.add(input.value);
                        } else {
                            selectedUserIds.delete(input.value);
                        }
                        updateSelectedCount();
                    });
                });
            };

            renderUserList();
            searchInput.addEventListener('input', (e) => {
                renderUserList(e.target.value);
            });

            initFilePickers(container);
            if (imageInput) {
                imageInput.addEventListener('change', () => {
                    imageFile = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
                    renderImagePreview();
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    title: form.title.value.trim(),
                    content: form.content.value.trim(),
                    is_important: !!form.is_important.checked,
                    dismiss_hours: parseInt(form.dismiss_hours.value || '2', 10)
                };
                if (!payload.title) return;
                if (!Number.isFinite(payload.dismiss_hours) || payload.dismiss_hours < 1) {
                    payload.dismiss_hours = 2;
                }
                if (payload.dismiss_hours > 168) payload.dismiss_hours = 168;
                if (selectedUserIds.size > 0) {
                    payload.target_user_ids = Array.from(selectedUserIds);
                }
                if (imageFile) {
                    if (!imageFile.type.startsWith('image/')) {
                        showToast('Ảnh thông báo phải là file ảnh', 'error');
                        return;
                    }
                    const bar = imagePreview ? imagePreview.querySelector('.upload-progress-bar') : null;
                    const text = imagePreview ? imagePreview.querySelector('.upload-progress-text') : null;
                    const fd = new FormData();
                    fd.append('file', imageFile);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        payload.image_url = upload.data.url;
                    }
                }
                await api.post('/admin/notifications', payload);
                showToast('Đã đăng thông báo', 'success');
                await loadNotifications();
            });

            function renderImagePreview() {
                if (!imagePreview) return;
                if (!imageFile) {
                    imagePreview.innerHTML = '';
                    return;
                }
                const url = URL.createObjectURL(imageFile);
                imagePreview.innerHTML = `
                    <div class="upload-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
                const btn = imagePreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        imageFile = null;
                        if (imageInput) imageInput.value = '';
                        setFileLabel(imageInput, imageLabel);
                        renderImagePreview();
                    });
                }
            }

            function updateSelectedCount() {
                if (!selectedCount) return;
                selectedCount.textContent = `${selectedUserIds.size} đã chọn`;
            }

            updateSelectedCount();
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông báo.</p>';
        }
    }

    async function loadInspect() {
        const container = document.getElementById('tab-inspect');
        if (!container) return;
        try {
            const res = await api.get('/admin/users', { limit: 300 });
            const users = res.success ? res.data : [];

            container.innerHTML = `
                <div class="section-card inspect-layout">
                    <div class="inspect-list">
                        <div class="section-header inspect-header">
                            <div>
                                <h3 class="section-title">Danh sách tài khoản</h3>
                                <p class="section-subtitle">Chọn để xem hoạt động chi tiết.</p>
                            </div>
                            <input type="text" id="inspect-search" class="input inspect-search" placeholder="Tìm theo email hoặc tên">
                        </div>
                        <div id="inspect-user-list" class="inspect-user-list"></div>
                    </div>
                    <div class="inspect-detail" id="inspect-detail">
                        <p>Chọn một tài khoản để xem chi tiết.</p>
                    </div>
                </div>
            `;

            const listEl = document.getElementById('inspect-user-list');
            const searchEl = document.getElementById('inspect-search');
            const detailEl = document.getElementById('inspect-detail');
            const safeText = (value) => escapeHtml(String(value ?? ''));
            const formatInspectIpSource = (source = '') => {
                switch (String(source || '').toLowerCase()) {
                    case 'register_ip':
                        return 'register';
                    case 'last_login_ip':
                        return 'last login';
                    case 'login':
                        return 'login';
                    case 'request':
                        return 'request';
                    case 'security':
                        return 'security';
                    case 'failed_login':
                        return 'failed login';
                    default:
                        return source || 'ip';
                }
            };

            const renderList = (keyword = '') => {
                const kw = keyword.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const email = (u.email || '').toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    return !kw || email.includes(kw) || name.includes(kw);
                });

                listEl.innerHTML = filtered.length ? filtered.map(u => `
                    <button class="inspect-user" data-id="${u.id}">
                        <div class="inspect-user-head">
                            <div class="inspect-user-email">${u.email}</div>
                            <span class="inspect-chip ${u.status === 'banned' ? 'chip-error' : 'chip-success'}">${u.status}</span>
                        </div>
                        <div class="inspect-user-meta">${u.full_name || '-'} â€¢ ${u.role}</div>
                        <div class="inspect-user-balance">${formatMoney(u.balance || 0)}</div>
                    </button>
                `).join('') : '<p>Không có tài khoản.</p>';

                listEl.querySelectorAll('.inspect-user').forEach(btn => {
                    btn.addEventListener('click', () => {
                        listEl.querySelectorAll('.inspect-user').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        loadDetail(btn.dataset.id);
                    });
                });
            };

            const renderDetail = (payload) => {
                if (!detailEl) return;
                if (!payload) {
                    detailEl.innerHTML = '<p>Không lấy được thông tin.</p>';
                    return;
                }
                const { user, activities = [] } = payload;
                const lastActive = user.last_login ? formatDateShort(user.last_login) : 'Chưa đăng nhập';
                const created = user.created_at ? formatDateShort(user.created_at) : '';
                const statusLabel = user.status === 'banned' ? 'Đã khóa' : 'Hoạt động';
                const lockAction = user.status === 'banned' ? 'Mở khóa' : 'Khóa nick';

                detailEl.innerHTML = `
                    <div class="inspect-head">
                        <div>
                            <h3 class="section-title">${user.full_name || 'Không tên'}</h3>
                            <p class="section-subtitle">${user.email}</p>
                        </div>
                        <div class="inspect-actions">
                            <span class="chip ${user.status === 'banned' ? 'chip-error' : 'chip-success'}">${statusLabel}</span>
                            <span class="chip chip-ghost">${user.role}</span>
                            <button id="inspect-lock-btn" class="btn-ghost">${lockAction}</button>
                        </div>
                    </div>
                    <div class="inspect-grid">
                        <div class="inspect-stat"><label>Số tiền</label><strong>${formatMoney(user.balance || 0)}</strong></div>
                        <div class="inspect-stat"><label>Giới tính</label><strong>${user.gender || '-'}</strong></div>
                        <div class="inspect-stat"><label>Hoạt động gần nhất</label><strong>${lastActive}</strong></div>
                        <div class="inspect-stat"><label>Ngày tạo</label><strong>${created}</strong></div>
                    </div>
                    <div class="inspect-timeline-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">Hoạt động gần đây</h4>
                            <span class="section-subtitle">Tối đa 15 sự kiện mới nhất</span>
                        </div>
                        ${activities.length ? `
                            <ul class="inspect-timeline">
                                ${activities.map(a => `
                                    <li>
                                        <div class="inspect-dot"></div>
                                        <div class="inspect-timeline-body">
                                            <div class="inspect-timeline-top">
                                                <span class="inspect-activity-type">${a.type}</span>
                                                <span class="inspect-activity-time">${formatDateShort(a.at)}</span>
                                            </div>
                                            <div class="inspect-activity-text">${a.text || ''}</div>
                                            ${a.amount !== undefined ? `<div class="inspect-amount ${a.amount < 0 ? 'minus' : 'plus'}">${formatMoney(a.amount)}</div>` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : '<p>Chưa ghi nhận hoạt động.</p>'}
                    </div>
                `;

                const lockBtn = document.getElementById('inspect-lock-btn');
                if (lockBtn) {
                    lockBtn.addEventListener('click', async () => {
                        const targetStatus = user.status === 'banned' ? 'active' : 'banned';
                        const pwd = prompt('Nhập mật khẩu admin để xác nhận:');
                        if (!pwd) return;
                        const resp = await api.post(`/admin/users/${user.id}/status`, {
                            status: targetStatus,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Cập nhật trạng thái thành công', 'success');
                            await loadInspect();
                        } else {
                            showToast(resp.message || 'Không thể cập nhật trạng thái', 'error');
                        }
                    });
                }
            };

            const renderInspectDetailWithIps = (payload) => {
                if (!detailEl) return;
                if (!payload) {
                    detailEl.innerHTML = '<p>Khong lay duoc thong tin.</p>';
                    return;
                }

                const { user, activities = [], recentIps = [] } = payload;
                const lastActive = user.last_login ? formatDateShort(user.last_login) : 'Chua dang nhap';
                const created = user.created_at ? formatDateShort(user.created_at) : '';
                const statusLabel = user.status === 'banned' ? 'Da khoa' : 'Hoat dong';
                const lockAction = user.status === 'banned' ? 'Mo khoa' : 'Khoa nick';
                const registerIp = user.register_ip || '-';
                const lastLoginIp = user.last_login_ip || '-';
                const failedLoginIp = user.last_failed_login_ip || '-';
                const loginLockUntil = user.login_locked_until ? formatDateShort(user.login_locked_until) : 'Khong';
                const securityLockReason = user.security_lock_reason === 'shared_ip_terms_lock'
                    ? 'Khoa chung theo IP'
                    : (user.security_lock_reason ? String(user.security_lock_reason) : 'Khong');

                detailEl.innerHTML = `
                    <div class="inspect-head">
                        <div>
                            <h3 class="section-title">${safeText(user.full_name || 'Khong ten')}</h3>
                            <p class="section-subtitle">${safeText(user.email || '')}</p>
                        </div>
                        <div class="inspect-actions">
                            <span class="chip ${user.status === 'banned' ? 'chip-error' : 'chip-success'}">${statusLabel}</span>
                            <span class="chip chip-ghost">${safeText(user.role || '-')}</span>
                            <button id="inspect-lock-btn" class="btn-ghost">${lockAction}</button>
                        </div>
                    </div>
                    <div class="inspect-grid">
                        <div class="inspect-stat"><label>Số tiền</label><strong>${formatMoney(user.balance || 0)}</strong></div>
                        <div class="inspect-stat"><label>Giới tính</label><strong>${safeText(user.gender || '-')}</strong></div>
                        <div class="inspect-stat"><label>Hoạt động gần nhất</label><strong>${safeText(lastActive)}</strong></div>
                        <div class="inspect-stat"><label>Ngày tạo</label><strong>${safeText(created)}</strong></div>
                        <div class="inspect-stat"><label>IP đăng ký</label><strong>${safeText(registerIp)}</strong></div>
                        <div class="inspect-stat"><label>IP login cuối</label><strong>${safeText(lastLoginIp)}</strong></div>
                        <div class="inspect-stat"><label>IP sai mật khẩu gần nhất</label><strong>${safeText(failedLoginIp)}</strong></div>
                        <div class="inspect-stat"><label>Khoá login đến</label><strong>${safeText(loginLockUntil)}</strong></div>
                        <div class="inspect-stat"><label>Khoá bảo mật</label><strong>${safeText(securityLockReason)}</strong></div>
                    </div>
                    <div class="inspect-ip-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">IP gan day</h4>
                            <span class="section-subtitle">Admin co the chan hoac mo chan tung IP</span>
                        </div>
                        ${recentIps.length ? `
                            <div class="inspect-ip-list">
                                ${recentIps.map((entry) => `
                                    <div class="inspect-ip-card">
                                        <div class="inspect-ip-main">
                                            <div class="inspect-ip-value">${safeText(entry.ip)}</div>
                                            <div class="inspect-ip-meta">
                                                <span>${entry.lastSeenAt ? formatDateShort(entry.lastSeenAt) : 'Chua xac dinh'}</span>
                                                <span>â€¢</span>
                                                <span>${entry.sources.map(formatInspectIpSource).map(safeText).join(', ')}</span>
                                            </div>
                                        </div>
                                        <div class="inspect-ip-actions">
                                            ${entry.block ? `
                                                <span class="inspect-chip ${entry.block.isManual ? 'chip-error' : 'chip-ghost'}">
                                                    ${entry.block.isManual ? 'Da chan thu cong' : 'Dang bi chan'}
                                                </span>
                                            ` : '<span class="inspect-chip chip-success">Binh thuong</span>'}
                                            <button
                                                type="button"
                                                class="${entry.block ? 'btn-outline' : 'btn-danger'}"
                                                ${entry.block ? `data-ip-unblock="${safeText(entry.ip)}"` : `data-ip-block="${safeText(entry.ip)}"`}
                                            >
                                                ${entry.block ? 'Mo chan IP' : 'Chan IP'}
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p>Chua ghi nhan IP nao cho tai khoan nay.</p>'}
                    </div>
                    <div class="inspect-timeline-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">Hoat dong gan day</h4>
                            <span class="section-subtitle">Toi da 15 su kien moi nhat</span>
                        </div>
                        ${activities.length ? `
                            <ul class="inspect-timeline">
                                ${activities.map(a => `
                                    <li>
                                        <div class="inspect-dot"></div>
                                        <div class="inspect-timeline-body">
                                            <div class="inspect-timeline-top">
                                                <span class="inspect-activity-type">${safeText(a.type || '')}</span>
                                                <span class="inspect-activity-time">${formatDateShort(a.at)}</span>
                                            </div>
                                            <div class="inspect-activity-text">${safeText(a.text || '')}</div>
                                            ${a.amount !== undefined ? `<div class="inspect-amount ${a.amount < 0 ? 'minus' : 'plus'}">${formatMoney(a.amount)}</div>` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : '<p>Chua ghi nhan hoat dong.</p>'}
                    </div>
                `;

                const lockBtn = document.getElementById('inspect-lock-btn');
                if (lockBtn) {
                    lockBtn.addEventListener('click', async () => {
                        const targetStatus = user.status === 'banned' ? 'active' : 'banned';
                        const pwd = prompt('Nhap mat khau admin de xac nhan:');
                        if (!pwd) return;
                        const resp = await api.post(`/admin/users/${user.id}/status`, {
                            status: targetStatus,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Cap nhat trang thai thanh cong', 'success');
                            await loadInspect();
                        } else {
                            showToast(resp.message || 'Khong the cap nhat trang thai', 'error');
                        }
                    });
                }

                detailEl.querySelectorAll('button[data-ip-block]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const targetIp = btn.dataset.ipBlock;
                        const pwd = prompt('Nhap mat khau admin de chan IP:');
                        if (!pwd) return;
                        const note = prompt('Ghi chu chan IP (co the bo trong):', user.email || '') || '';
                        const resp = await api.post('/admin/ip-blocks/block', {
                            ip: targetIp,
                            note,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Da chan IP thanh cong', 'success');
                            await loadDetail(user.id);
                        } else {
                            showToast(resp.message || 'Khong the chan IP', 'error');
                        }
                    });
                });

                detailEl.querySelectorAll('button[data-ip-unblock]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const targetIp = btn.dataset.ipUnblock;
                        const pwd = prompt('Nhap mat khau admin de mo chan IP:');
                        if (!pwd) return;
                        const resp = await api.post('/admin/ip-blocks/unblock', {
                            ip: targetIp,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Da mo chan IP', 'success');
                            await loadDetail(user.id);
                        } else {
                            showToast(resp.message || 'Khong the mo chan IP', 'error');
                        }
                    });
                });
            };

            const loadDetail = async (userId) => {
                detailEl.innerHTML = '<p>Đang tải...</p>';
                const res = await api.get(`/admin/users/${userId}/inspect`);
                if (res.success) {
                    renderInspectDetailWithIps(res.data);
                } else {
                    detailEl.innerHTML = '<p>Không thể tải chi tiết.</p>';
                }
            };

            renderList();

            if (searchEl) {
                searchEl.addEventListener('input', (e) => renderList(e.target.value));
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh sách tài khoản.</p>';
        }
    }

    async function loadSecurity() {
        const container = document.getElementById('tab-security');
        if (!container) return;

        const safeText = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const renderSecurity = (payload = {}) => {
            const summary = payload.summary || {};
            const blockedApis = Array.isArray(payload.blockedApis) ? payload.blockedApis : [];
            const blockedIps = Array.isArray(payload.activeIpBlocks) ? payload.activeIpBlocks : [];
            const lockedAccounts = Array.isArray(payload.lockedAccounts) ? payload.lockedAccounts : [];
            const recentBlockedRequests = Array.isArray(payload.recentBlockedRequests) ? payload.recentBlockedRequests : [];

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Trung tâm bảo mật</h3>
                            <p class="section-subtitle">Theo dõi API bị chặn, IP đang bị block và các tài khoản đang bị khóa.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button id="security-refresh-btn" class="btn-outline">Tải lại</button>
                            <button id="security-open-logs-btn" class="btn-outline">Mở Logs</button>
                            <button id="security-open-inspect-btn" class="btn-outline">Check tài khoản</button>
                        </div>
                    </div>
                    <div class="stat-grid">
                        <div class="stat-card">API bị chặn: <strong>${Number(summary.blockedApiEndpointCount || 0)}</strong></div>
                        <div class="stat-card">Lượt chặn API: <strong>${Number(summary.blockedApiEventCount || 0)}</strong></div>
                        <div class="stat-card">IP đang block: <strong>${Number(summary.blockedIpCount || 0)}</strong></div>
                        <div class="stat-card">Tài khoản đang khóa: <strong>${Number(summary.lockedAccountCount || 0)}</strong></div>
                    </div>
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">API đã bị chặn</h3>
                            <p class="section-subtitle">Tổng hợp endpoint bị chặn gần đây từ hệ thống bảo mật.</p>
                        </div>
                        <span class="badge badge-danger">${blockedApis.length} endpoint</span>
                    </div>
                    ${blockedApis.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>API</th>
                                    <th>Số lần</th>
                                    <th>IP mẫu</th>
                                    <th>Lần cuối</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${blockedApis.map((item) => `
                                    <tr>
                                        <td><strong>${safeText(item.endpoint || `${item.method || ''} ${item.path || ''}`.trim())}</strong></td>
                                        <td>${Number(item.count || 0)}</td>
                                        <td>${safeText((item.sampleIps || []).join(', ') || '-')}</td>
                                        <td>${item.lastBlockedAt ? formatDateShort(item.lastBlockedAt) : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Chưa có API nào bị chặn trong dữ liệu hiện có.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">IP đang bị chặn</h3>
                            <p class="section-subtitle">Danh sách block còn hiệu lực.</p>
                        </div>
                        <span class="badge badge-warning">${blockedIps.length} IP</span>
                    </div>
                    ${blockedIps.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>Lý do</th>
                                    <th>Chi tiết</th>
                                    <th>Đến</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${blockedIps.map((item) => `
                                    <tr>
                                        <td>${safeText(item.ip || '-')}</td>
                                        <td>${safeText(item.reason || '-')}</td>
                                        <td>${safeText(item.detail || '-')}</td>
                                        <td>${item.blockUntil ? formatDateShort(item.blockUntil) : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có IP nào đang bị chặn.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Tài khoản đang khóa</h3>
                            <p class="section-subtitle">Bao gồm khóa đăng nhập, khóa bảo mật và trạng thái banned.</p>
                        </div>
                        <span class="badge badge-info">${lockedAccounts.length} tài khoản</span>
                    </div>
                    ${lockedAccounts.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Tài khoản</th>
                                    <th>Vai trò</th>
                                    <th>Trạng thái</th>
                                    <th>Lý do khóa</th>
                                    <th>Khóa login đến</th>
                                    <th>IP bảo mật</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lockedAccounts.map((item) => `
                                    <tr>
                                        <td>${Number(item.id || 0)}</td>
                                        <td>
                                            <div><strong>${safeText(item.email || '-')}</strong></div>
                                            <div class="section-subtitle">${safeText(item.full_name || '-')}</div>
                                        </td>
                                        <td>${safeText(item.role || '-')}</td>
                                        <td>${safeText(item.status || '-')}</td>
                                        <td>${safeText((item.lock_reasons || []).join(', ') || '-')}</td>
                                        <td>${item.login_locked_until ? formatDateShort(item.login_locked_until) : '-'}</td>
                                        <td>${safeText(item.security_locked_ip || item.last_login_ip || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có tài khoản nào đang bị khóa.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Lượt chặn gần đây</h3>
                            <p class="section-subtitle">Các request mới nhất bị hệ thống từ chối.</p>
                        </div>
                        <span class="badge badge-secondary">${recentBlockedRequests.length} dòng</span>
                    </div>
                    ${recentBlockedRequests.length ? `
                        <div class="log-list">
                            ${recentBlockedRequests.map((item) => `
                                <div class="log-item">
                                    <span class="log-time">${item.at ? formatDateShort(item.at) : '-'}</span>
                                    <span class="log-badge badge badge-danger">${safeText(item.reason || 'blocked')}</span>
                                    <span class="log-text">${safeText(item.endpoint || `${item.method || ''} ${item.path || ''}`.trim() || '-')} ${item.ip ? `â€¢ ${safeText(item.ip)}` : ''}${item.detail ? ` â€¢ ${safeText(item.detail)}` : ''}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Chưa có request bị chặn trong bộ nhớ log hiện tại.</p>'}
                </div>
            `;

            const refreshBtn = document.getElementById('security-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    await fetchSecurity();
                });
            }

            const openLogsBtn = document.getElementById('security-open-logs-btn');
            if (openLogsBtn) {
                openLogsBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=logs');
                });
            }

            const openInspectBtn = document.getElementById('security-open-inspect-btn');
            if (openInspectBtn) {
                openInspectBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=inspect');
                });
            }
        };

        const fetchSecurity = async () => {
            try {
                const res = await api.get('/admin/security-overview');
                if (!res.success) {
                    throw new Error('Khong the tai du lieu bao mat');
                }
                renderSecurity(res.data || {});
            } catch (error) {
                container.innerHTML = '<p>Khong the tai trung tam bao mat.</p>';
            }
        };

        await fetchSecurity();
    }

    // Logs
    async function loadLogs() {
        const container = document.getElementById('tab-logs');
        if (!container) return;
        const fetchLogs = async () => {
            try {
                const res = await api.get('/admin/logs', { limit: 200 });
                if (!res.success) return;
                renderLogs(container, res.data || []);
            } catch (error) {
                container.innerHTML = '<p>Không thể tải log.</p>';
            }
        };
        await fetchLogs();
        logInterval = setInterval(fetchLogs, 4000);
    }

    function renderLogs(container, items) {
        if (!items.length) {
            container.innerHTML = '<p>Chưa có log.</p>';
            return;
        }
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h3 class="section-title">Logs gần đây</h3>
                    <p class="section-subtitle">Yêu cầu API và sự kiện đăng nhập (tối đa 200 dòng, tự cập nhật 4s).</p>
                </div>
            </div>
            <div class="log-list">${items.map(renderLogItem).join('')}</div>
        `;
    }

    function renderLogItem(log) {
        const time = formatDateShort(log.ts || new Date().toISOString());
        if (log.type === 'login') {
            return `
                <div class="log-item">
                    <span class="log-time">${time}</span>
                    <span class="log-badge badge badge-info">LOGIN</span>
                    <span class="log-text">${log.email || 'unknown'} ${log.success ? 'đăng nhập thành công' : 'đăng nhập thất bại'}${log.userId ? ` (id ${log.userId})` : ''}</span>
                </div>
            `;
        }
        if (log.type === 'security') {
            return `
                <div class="log-item">
                    <span class="log-time">${time}</span>
                    <span class="log-badge badge badge-danger">SECURITY</span>
                    <span class="log-text">${log.action || 'security'}${log.ip ? ` â€¢ ${log.ip}` : ''}${log.reason ? ` â€¢ ${log.reason}` : ''}${log.path ? ` â€¢ ${log.path}` : ''}${log.detail ? ` â€¢ ${log.detail}` : ''}</span>
                </div>
            `;
        }
        return `
            <div class="log-item">
                <span class="log-time">${time}</span>
                <span class="log-badge badge badge-secondary">${log.status || ''}</span>
                <span class="log-text">${log.method || ''} ${log.path || ''} â€¢ ${log.durationMs || 0}ms${log.email ? ` â€¢ ${log.email}` : ''}</span>
            </div>
        `;
    }

    async function loadStorage() {
        const container = document.getElementById('tab-storage');
        if (!container) return;
        try {
            const response = await api.get('/admin/storage-info');
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
                return;
            }
            const info = response.data || {};
            const counts = info.counts || {};
            const tables = info.tables || [];
            const tableLabels = {
                users: 'Tài khoản',
                products: 'Sản phẩm',
                product_images: 'Ảnh sản phẩm',
                product_categories: 'Danh mục sản phẩm',
                categories: 'Danh mục',
                posts: 'Bài đăng',
                post_media: 'Media bài đăng',
                post_likes: 'Like bài đăng',
                post_comments: 'Bình luận',
                messages: 'Tin nhắn',
                community_messages: 'Cộng đồng',
                notifications: 'Thông báo',
                notification_reads: 'Đã đọc thông báo',
                purchases: 'Đơn mua',
                deposit_requests: 'Yêu cầu nạp',
                transactions: 'Giao dịch',
                system_settings: 'Cấu hình',
                api_keys: 'API Key'
            };

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tổng quan lưu trữ</h3>
                    <div class="stat-grid">
                        <div class="stat-card">Dung lượng DB: <strong>${formatBytes(info.dbSizeBytes || 0)}</strong></div>
                        <div class="stat-card">Users: <strong>${counts.users || 0}</strong></div>
                        <div class="stat-card">Sản phẩm: <strong>${counts.products || 0}</strong></div>
                        <div class="stat-card">Bài đăng: <strong>${counts.posts || 0}</strong></div>
                        <div class="stat-card">Tin nhắn: <strong>${counts.messages || 0}</strong></div>
                        <div class="stat-card">Cộng đồng: <strong>${counts.community_messages || 0}</strong></div>
                        <div class="stat-card">Thông báo: <strong>${counts.notifications || 0}</strong></div>
                    </div>
                </div>
                <div class="section-card section-spaced">
                    <h3 class="section-title">Chi tiết theo bảng</h3>
                    ${tables.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nội dung</th>
                                    <th>Bảng</th>
                                    <th>Số dòng</th>
                                    <th>Dung lượng</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tables.map(t => `
                                    <tr>
                                        <td>${tableLabels[t.name] || 'Khác'}</td>
                                        <td>${t.name}</td>
                                        <td>${t.rows || 0}</td>
                                        <td>${formatBytes(t.bytes || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có dữ liệu bảng.</p>'}
                </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Sao lưu dữ liệu</h3>
                      <p class="section-subtitle">Xuất toàn bộ dữ liệu thành file JSON hoặc gửi thẳng lên Telegram bot.</p>
                      <div class="badge-row section-spaced">
                          <div class="badge badge-info">data.json</div>
                          <div class="badge badge-success">Telegram backup</div>
                      </div>
                      <div class="hero-actions">
                          <button id="export-data" class="btn-primary">Tải data.json</button>
                          <button id="send-telegram" class="btn-outline">Gửi Telegram</button>
                      </div>
                  </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Chia sẻ dữ liệu</h3>
                      <p class="section-subtitle">Xuất dữ liệu ít sử dụng sang file JSON (chiase.json) để giảm dung lượng DB.</p>
                      <div class="hero-actions">
                          <button id="open-share-data" class="btn-primary">Chia sẻ dữ liệu</button>
                      </div>
                  </div>
                  <div class="section-card">
                      <h3 class="section-title">Chính sách lưu trữ</h3>
                      <div class="stat-grid">
                          <div class="stat-card">Thông báo: <strong>tự xóa sau 12 giờ</strong></div>
                        <div class="stat-card">Tin nhắn cộng đồng: <strong>tự xóa sau 7 ngày</strong></div>
                    </div>
                </div>
            `;

            const exportBtn = document.getElementById('export-data');
            const telegramBtn = document.getElementById('send-telegram');
            const shareBtn = document.getElementById('open-share-data');

            if (exportBtn) {
                exportBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${api.baseURL}/admin/backup/export`, {
                            headers: api.getHeaders()
                        });
                        if (!res.ok) throw new Error('Export failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'data.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } catch (error) {
                        showToast(error.message || 'Không thể xuất dữ liệu', 'error');
                    }
                });
            }

            if (telegramBtn) {
                telegramBtn.addEventListener('click', async () => {
                    try {
                        await api.post('/admin/backup/telegram', {});
                        showToast('Đã gửi backup lên Telegram', 'success');
                    } catch (error) {
                        showToast(error.message || 'Không thể gửi Telegram', 'error');
                    }
                });
            }

            if (shareBtn) {
                shareBtn.addEventListener('click', () => {
                    openShareDataModal();
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
        }
    }

    async function loadSettings() {
        const container = document.getElementById('tab-settings');
        if (!container) return;
        container.innerHTML = `
            <div class="settings-accordion">
                <div class="settings-section active">
                    <button type="button" class="settings-header">Thông tin chuyển khoản</button>
                    <div class="settings-body">
                        <form id="bank-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên ngân hàng</label>
                                <input type="text" name="bank_name" placeholder="VD: Vietcombank">
                            </div>
                            <div class="form-group">
                                <label>Số tài khoản</label>
                                <input type="text" name="bank_account_number" placeholder="VD: 0123456789">
                            </div>
                            <div class="form-group">
                                <label>Tên tài khoản</label>
                                <input type="text" name="bank_account_name" placeholder="VD: Nguyen Van A">
                            </div>
                            <div class="form-group">
                                <label>Link QR (ảnh)</label>
                                <input type="text" name="bank_qr_url" placeholder="https://...">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung chuyển khoản (tuỳ chọn)</label>
                                <input type="text" name="bank_note" placeholder="VD: NAPTIEN + SĐT">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu thông tin</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nội dung trang chủ</button>
                    <div class="settings-body">
                        <form id="hero-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Phiên bản hiển thị</label>
                                <select name="home_page_version">
                                    <option value="v1">V1 (mặc định)</option>
                                    <option value="v2">V2 (dùng file v2.html)</option>
                                </select>
                                <small id="home-page-version-hint" class="home-version-note">
                                    V1 dùng các ô bên dưới. V2 lấy nội dung trực tiếp từ file <code>frontend/pages/v2.html</code>, muốn sửa V2 thì sửa file này.
                                </small>
                            </div>
                            <div id="hero-v1-fields" class="home-version-v1-fields form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề chính</label>
                                <input type="text" name="hero_title" placeholder="Dịch vụ lập trình Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả chính</label>
                                <textarea name="hero_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Text</label>
                                <input type="text" name="hero_btn_primary_text" placeholder="Đăng bán ngay">
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Link</label>
                                <input type="text" name="hero_btn_primary_link" placeholder="/dangban">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Text</label>
                                <input type="text" name="hero_btn_secondary_text" placeholder="Nạp tiền">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Link</label>
                                <input type="text" name="hero_btn_secondary_link" placeholder="/naptien">
                            </div>
                            <div class="form-group full">
                                <label>Tiêu đề khối bên phải</label>
                                <input type="text" name="hero_card_title" placeholder="Vì sao chọn Sang dev shop?">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả khối bên phải</label>
                                <textarea name="hero_card_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Badge (mỗi dòng 1 badge)</label>
                                <textarea name="hero_badges" rows="3" placeholder="Bảo mật tài khoản&#10;Thanh toán linh hoạt"></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nội dung</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nhạc nền Banner V2</button>
                    <div class="settings-body">
                        <form id="music-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Upload nhạc cho Banner V2</label>
                                <div class="file-picker">
                                    <input type="file" id="default-music-file" class="file-input" accept="audio/*,video/mp4" multiple>
                                    <button type="button" class="btn-outline file-btn" data-file-target="default-music-file" data-file-label="default-music-label">Chọn file</button>
                                    <span id="default-music-label" class="file-label">Chưa chọn file</span>
                                </div>
                                <small>Chọn một hoặc nhiều file. Khi bấm lưu, hệ thống sẽ tải lên Cloudinary rồi tự thêm vào playlist.</small>
                            </div>
                            <div class="form-group">
                                <label>Chế độ phát</label>
                                <select name="banner_v2_music_order">
                                    <option value="sequential">Theo thứ tự</option>
                                    <option value="shuffle">Ngẫu nhiên</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Cloudinary upload preset</label>
                                <input type="text" name="cloudinary_music_preset" placeholder="ml_default">
                            </div>
                            <div class="form-group full">
                                <label>Playlist nhạc</label>
                                <textarea name="banner_v2_music_playlist" rows="6" placeholder="Tên bài | https://example.com/song.mp3&#10;Nhạc YouTube | https://youtu.be/example"></textarea>
                                <small>Mỗi dòng một bài. Có thể nhập <code>Tên bài | link</code> hoặc chỉ nhập link. Hỗ trợ link nhạc thường và link YouTube.</small>
                            </div>
                            <div class="form-group full">
                                <div id="default-music-preview" class="upload-preview"></div>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nhạc Banner V2</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nút liên hệ</button>
                    <div class="settings-body">
                        <form id="frame-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Upload khung avatar</label>
                                <div class="file-picker">
                                    <input type="file" id="admin-frame-file" class="file-input" accept="image/png,image/jpeg,image/gif,image/webp">
                                    <button type="button" class="btn-outline file-btn" data-file-target="admin-frame-file" data-file-label="admin-frame-file-label">Chon file</button>
                                    <span id="admin-frame-file-label" class="file-label">Chua chon file</span>
                                </div>
                                <small>Khung se luu local trong thu muc <code>khungcanhan</code> va hien cho user o trang ca nhan.</small>
                            </div>
                            <div class="form-group full">
                                <div id="admin-frame-preview" class="upload-preview"></div>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Tai khung len</button>
                            </div>
                        </form>
                        <div id="admin-frame-list" class="section-spaced"></div>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Khung avatar mau</button>
                    <div class="settings-body">
                        <form id="contact-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Text nút</label>
                                <input type="text" name="text" placeholder="Ví dụ: Liên hệ Zalo">
                            </div>
                            <div class="form-group">
                                <label>Link nút</label>
                                <input type="text" name="link" placeholder="https://zalo.me/...">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nút</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Footer</button>
                    <div class="settings-body">
                        <form id="footer-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="footer_title" placeholder="Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả</label>
                                <textarea name="footer_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên kết</label>
                                <input type="text" name="footer_links_title" placeholder="Liên kết">
                            </div>
                            <div class="form-group">
                                <label>Liên kết (mỗi dòng: Text | /link)</label>
                                <textarea name="footer_links" rows="3" placeholder="Trang chủ | /\nBài đăng | /baidang"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên hệ</label>
                                <input type="text" name="footer_contact_title" placeholder="Liên hệ">
                            </div>
                            <div class="form-group">
                                <label>Email liên hệ</label>
                                <input type="text" name="footer_contact_email" placeholder="Email: ...">
                            </div>
                            <div class="form-group full">
                                <label>Bản quyền</label>
                                <input type="text" name="footer_copyright" placeholder="© 2026 Sang dev. All rights reserved.">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">LÆ°u footer</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Menu tài khoản</button>
                    <div class="settings-body">
                        <form id="account-menu-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Nút cố định</label>
                                <input type="text" value="Trang chủ, Mã nguồn, Vòng quay may mắn, Điểm danh, Quản trị, Đăng xuất" disabled>
                                <small>Các nút này luôn có sẵn trong menu.</small>
                            </div>
                            <div class="form-group full">
                                <label>Nút phụ (mỗi dòng: Tên | /link hoặc https://...)</label>
                                <textarea
                                    name="account_menu_extra_links"
                                    rows="5"
                                    placeholder="Bài đăng | /baidang&#10;Nạp tiền | /naptien&#10;Hỗ trợ | /hotro"
                                ></textarea>
                                <small>Admin có thể sửa, thêm hoặc xóa các nút phụ ở đây.</small>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">LÆ°u menu</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Vòng quay may mắn</button>
                    <div class="settings-body">
                        <form id="lucky-spin-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="lucky_spin_enabled">
                                    Bật mini game
                                </label>
                                <small>Moi tai khoan chi co 1 luot quay trong ngay su kien hang tuan.</small>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề</label>
                                <input type="text" name="lucky_spin_title" placeholder="Vong quay may man">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả ngắn</label>
                                <input type="text" name="lucky_spin_subtitle" placeholder="He thong mo 1 ngay moi tuan va xu ly ket qua tai server">
                            </div>
                            <div class="form-group">
                                <label>Che do lich</label>
                                <select name="lucky_spin_schedule_mode">
                                    <option value="auto">Tu dong chon 1 ngay / tuan</option>
                                    <option value="manual">Admin tu chon thu</option>
                                </select>
                            </div>
                            <div class="form-group" id="lucky-spin-schedule-day-group">
                                <label>Ngay mo vong quay</label>
                                <select name="lucky_spin_manual_weekday">
                                    <option value="1">Thu 2</option>
                                    <option value="2">Thu 3</option>
                                    <option value="3">Thu 4</option>
                                    <option value="4">Thu 5</option>
                                    <option value="5">Thu 6</option>
                                    <option value="6">Thu 7</option>
                                    <option value="7">Chu nhat</option>
                                </select>
                                <small>Neu de auto, he thong tu random 1 ngay trong tuan va gui thong bao truoc 1 ngay.</small>
                            </div>
                            <div class="form-group full">
                                <label>Thiết lập nhanh</label>
                                <div class="builder-presets">
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="lucky-spin" data-builder-preset="balanced">Mẫu cân bằng</button>
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="lucky-spin" data-builder-preset="safe">Mẫu an toàn</button>
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="lucky-spin" data-builder-preset="jackpot">Mẫu jackpot</button>
                                </div>
                                <small>Chọn mẫu trước rồi chỉ việc sửa lại số tiền hoặc tỷ lệ nếu cần.</small>
                            </div>
                            <div class="form-group full">
                                <label>Danh sách phần thưởng</label>
                                <div id="lucky-spin-builder" class="config-builder"></div>
                                <div class="builder-actions">
                                    <button type="button" id="lucky-spin-add-row" class="btn-outline">Thêm phần thưởng</button>
                                    <div id="lucky-spin-summary" class="builder-summary"></div>
                                </div>
                                <textarea name="lucky_spin_rewards_text" class="builder-source" rows="1"></textarea>
                                <small>Chỉ cần điền tên thưởng, số tiền và tỷ lệ. Màu có thể để mặc định.</small>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu vòng quay</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Điểm danh hàng ngày</button>
                    <div class="settings-body">
                        <form id="daily-checkin-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="daily_checkin_enabled">
                                    Bật điểm danh
                                </label>
                                <small>Mỗi tài khoản chỉ nhận được 1 lần mỗi ngày theo ngày server.</small>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề</label>
                                <input type="text" name="daily_checkin_title" placeholder="Điểm danh nhận tiền">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả ngắn</label>
                                <input type="text" name="daily_checkin_subtitle" placeholder="Backend sẽ tự tính ngày nhận và streak">
                            </div>
                            <div class="form-group full">
                                <label>Thiết lập nhanh</label>
                                <div class="builder-presets">
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="daily-checkin" data-builder-preset="weekly">Mẫu 7 ngày</button>
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="daily-checkin" data-builder-preset="steady">Mẫu đều</button>
                                    <button type="button" class="btn-outline builder-preset-btn" data-builder-target="daily-checkin" data-builder-preset="boost">Mẫu tăng dần</button>
                                </div>
                                <small>Chọn mẫu trước rồi sửa số tiền từng ngày cho nhanh.</small>
                            </div>
                            <div class="form-group full">
                                <label>Mốc thưởng 7 ngày cố định</label>
                                <div id="daily-checkin-builder" class="config-builder"></div>
                                <div class="builder-actions">
                                    <div id="daily-checkin-summary" class="builder-summary"></div>
                                </div>
                                <textarea name="daily_checkin_rewards_text" class="builder-source" rows="1"></textarea>
                                <small>Admin chỉ cần set tiền cho 7 ngày. Hệ thống sẽ chạy vòng lặp ngày 1 đến ngày 7 rồi quay lại ngày 1.</small>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu điểm danh</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Điều khoản dịch vụ</button>
                    <div class="settings-body">
                        <form id="tos-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="tos_title" placeholder="Điều khoản dịch vụ">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung (mỗi dòng là 1 đoạn)</label>
                                <textarea name="tos_content" rows="6" placeholder="Nhập nội dung điều khoản..."></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu điều khoản</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Cấu hình AI Assistant</button>
                    <div class="settings-body">
                        <form id="ai-config-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên AI</label>
                                <input type="text" name="ai_name" placeholder="VD: Sang AI Assistant" maxlength="120">
                            </div>
                            <div class="form-group">
                                <label>Gemini API Key</label>
                                <input type="password" name="ai_api_key" placeholder="Để trống nếu giữ nguyên key">
                                <small id="ai-api-key-status">Chưa có API key.</small>
                            </div>
                            <div class="form-group full">
                                <label>Tính cách AI</label>
                                <textarea name="ai_personality" rows="3" placeholder="VD: Lịch sự, ngắn gọn, đi thẳng vào vấn đề"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Kiến thức / phạm vi trả lời</label>
                                <textarea name="ai_knowledge" rows="3" placeholder="VD: Mua bán source code, nạp tiền, tải xuống, demo sản phẩm"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Prompt hệ thống bổ sung</label>
                                <textarea name="ai_system_prompt" rows="5" placeholder="Hướng dẫn riêng để AI trả lời theo phong cách bạn muốn"></textarea>
                            </div>
                            <div class="form-group full ai-config-actions">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="clear_ai_api_key">
                                    Xóa API key đang lưu
                                </label>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu cấu hình AI</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Bot nội bộ Python</button>
                    <div class="settings-body">
                        <form id="private-bot-config-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tên bot</label>
                                <input type="text" name="private_bot_name" placeholder="VD: Sang Internal Bot" maxlength="120">
                            </div>
                            <div class="form-group full">
                                <label>Bot API URL</label>
                                <input type="text" name="private_bot_api_url" placeholder="VD: http://127.0.0.1:3001/api/private-bot">
                            </div>
                            <div class="form-group full">
                                <label>Bot API Key</label>
                                <input type="password" name="private_bot_api_key" placeholder="Để trống nếu giữ nguyên key">
                                <small id="private-bot-api-key-status">Chưa có API key.</small>
                            </div>
                            <div class="form-group full">
                                <label>Danh sách chat ID được phép</label>
                                <textarea name="private_bot_allowed_chat_ids" rows="3" placeholder="Ví dụ: 123456789,987654321"></textarea>
                                <small>Phân tách bằng dấu phẩy. Chỉ những ID này mới dùng được bot.</small>
                            </div>
                            <div class="form-group full">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="private_bot_enabled">
                                    Bật bot nội bộ
                                </label>
                            </div>
                            <div class="form-group full ai-config-actions">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="clear_private_bot_api_key">
                                    Xóa API key đang lưu
                                </label>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu cấu hình bot</button>
                            </div>
                        </form>
                        <div class="section-card section-spaced">
                            <div class="section-header">
                                <h3 class="section-title">Mẫu cấu hình Python</h3>
                                <div class="hero-actions">
                                    <button type="button" id="copy-private-bot-env" class="btn-outline">Copy .env</button>
                                    <button type="button" id="copy-private-bot-python" class="btn-outline">Copy Python</button>
                                </div>
                            </div>
                            <pre id="private-bot-snippet" class="share-json-output" style="white-space:pre-wrap; margin:0;"></pre>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">API Key tích hợp</button>
                    <div class="settings-body">
                        <form id="api-key-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tên key</label>
                                <input type="text" name="name" placeholder="VD: đối tác A" required>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Tạo API key</button>
                            </div>
                        </form>
                        <div id="api-key-result" class="section-card section-spaced" style="display:none;"></div>
                        <div id="api-key-list" class="section-card section-spaced"></div>
                    </div>
                </div>
            </div>
        `;

        initFilePickers(container);
        const frameSection = document.getElementById('frame-setting-form')?.closest('.settings-section');
        const contactSection = document.getElementById('contact-setting-form')?.closest('.settings-section');
        const frameHeader = frameSection ? frameSection.querySelector('.settings-header') : null;
        const contactHeader = contactSection ? contactSection.querySelector('.settings-header') : null;
        if (frameHeader) frameHeader.textContent = 'Khung avatar mau';
        if (contactHeader) contactHeader.textContent = 'Nut liên hệ';

        const contactForm = document.getElementById('contact-setting-form');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = contactForm.text.value.trim();
                const link = contactForm.link.value.trim();
                await api.put('/admin/settings/contact_button_text', { value: text });
                await api.put('/admin/settings/contact_button_link', { value: link });
                showToast('Đã cập nhật nút liên hệ', 'success');
            });
        }

        const footerForm = document.getElementById('footer-setting-form');
        if (footerForm) {
            const footerKeys = [
                'footer_title',
                'footer_subtitle',
                'footer_links_title',
                'footer_links',
                'footer_contact_title',
                'footer_contact_email',
                'footer_copyright'
            ];

            try {
                const res = await api.get('/settings', { keys: footerKeys.join(',') });
                if (res.success) {
                    footerKeys.forEach(key => {
                        if (footerForm[key]) footerForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            footerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of footerKeys) {
                    const value = footerForm[key] ? footerForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật footer', 'success');
            });
        }

        const saveSettingEntries = async (entries = []) => {
            await Promise.all(entries.map(([key, value]) => api.put(`/admin/settings/${key}`, { value })));
        };

        const luckySpinPresets = {
            balanced: [
                { label: 'Chuc ban may man', amount: '0', weight: '30', color: '#1f2937' },
                { label: 'Thưởng 1.000đ', amount: '1000', weight: '38', color: '#0ea5e9' },
                { label: 'Thưởng 2.000đ', amount: '2000', weight: '18', color: '#22c55e' },
                { label: 'Thưởng 5.000đ', amount: '5000', weight: '10', color: '#f59e0b' },
                { label: 'Jackpot mini', amount: '10000', weight: '4', color: '#ef4444' }
            ],
            safe: [
                { label: 'Chuc ban may man', amount: '0', weight: '36', color: '#1f2937' },
                { label: 'Thưởng 500đ', amount: '500', weight: '28', color: '#0ea5e9' },
                { label: 'Thưởng 1.000đ', amount: '1000', weight: '22', color: '#22c55e' },
                { label: 'Thưởng 2.000đ', amount: '2000', weight: '10', color: '#f59e0b' },
                { label: 'Thưởng 3.000đ', amount: '3000', weight: '4', color: '#ef4444' }
            ],
            jackpot: [
                { label: 'Chuc ban may man', amount: '0', weight: '42', color: '#1f2937' },
                { label: 'Thưởng 2.000đ', amount: '2000', weight: '26', color: '#0ea5e9' },
                { label: 'Thưởng 5.000đ', amount: '5000', weight: '18', color: '#22c55e' },
                { label: 'Thưởng 10.000đ', amount: '10000', weight: '10', color: '#f59e0b' },
                { label: 'Jackpot 20.000đ', amount: '20000', weight: '4', color: '#ef4444' }
            ]
        };

        const dailyCheckinPresets = {
            weekly: [
                { day: '1', amount: '1000', label: 'Bat dau' },
                { day: '2', amount: '1500', label: 'On dinh' },
                { day: '3', amount: '2000', label: 'Tang toc' },
                { day: '4', amount: '2500', label: 'Chuyen can' },
                { day: '5', amount: '3000', label: 'Ben bi' },
                { day: '6', amount: '4000', label: 'Gan dich' },
                { day: '7', amount: '5000', label: 'Moc tuan' }
            ],
            steady: [
                { day: '1', amount: '1000', label: 'Ngày 1' },
                { day: '2', amount: '1000', label: 'Ngày 2' },
                { day: '3', amount: '1000', label: 'Ngày 3' },
                { day: '4', amount: '1000', label: 'Ngày 4' },
                { day: '5', amount: '1000', label: 'Ngày 5' },
                { day: '6', amount: '1000', label: 'Ngày 6' },
                { day: '7', amount: '1000', label: 'Ngày 7' }
            ],
            boost: [
                { day: '1', amount: '500', label: 'Khoi dong' },
                { day: '2', amount: '1000', label: 'Len nhip' },
                { day: '3', amount: '1500', label: 'On form' },
                { day: '4', amount: '2500', label: 'Tang luc' },
                { day: '5', amount: '3500', label: 'Rat deu' },
                { day: '6', amount: '5000', label: 'Can dich' },
                { day: '7', amount: '7000', label: 'Bung no' }
            ]
        };

        const cloneRows = (rows = []) => rows.map(row => ({ ...row }));

        const escapeBuilderValue = (value = '') => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const sanitizeIntegerText = (value, fallback = '1', min = 1) => {
            const digits = String(value ?? '').replace(/[^\d-]/g, '');
            const parsed = parseInt(digits, 10);
            return String(Number.isFinite(parsed) ? Math.max(min, parsed) : parseInt(fallback, 10));
        };

        const sanitizeMoneyText = (value, fallback = '0') => {
            const digits = String(value ?? '').replace(/[^\d.-]/g, '');
            const parsed = Number(digits);
            return String(Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : parseInt(fallback, 10));
        };

        const parseLuckySpinRows = (raw = '') => {
            const rows = String(raw || '')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map((line, index) => {
                    const parts = line.split('|').map(item => item.trim());
                    return {
                        label: parts[0] || `Phan thuong ${index + 1}`,
                        amount: sanitizeMoneyText(parts[1], '0'),
                        weight: sanitizeIntegerText(parts[2], '1', 1),
                        color: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(parts[3] || '') ? parts[3] : '#0ea5e9'
                    };
                });

            return rows.length ? rows : cloneRows(luckySpinPresets.balanced);
        };

        const serializeLuckySpinRows = (rows = []) => rows
            .map((row, index) => {
                const label = (row.label || '').trim() || `Phan thuong ${index + 1}`;
                const amount = sanitizeMoneyText(row.amount, '0');
                const weight = sanitizeIntegerText(row.weight, '1', 1);
                const color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(row.color || '') ? row.color : '#0ea5e9';
                return `${label} | ${amount} | ${weight} | ${color}`;
            })
            .join('\n');

        const parseDailyCheckinRows = (raw = '') => {
            const rewardMap = new Map(
                String(raw || '')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map((line, index) => {
                    const parts = line.split('|').map(item => item.trim());
                    const day = sanitizeIntegerText(parts[0], String(index + 1), 1);
                    return [day, {
                        day,
                        amount: sanitizeMoneyText(parts[1], '0'),
                        label: parts[2] || `Ngày ${day}`
                    }];
                })
            );

            return Array.from({ length: 7 }, (_, index) => {
                const day = String(index + 1);
                return rewardMap.get(day) || {
                    day,
                    amount: sanitizeMoneyText(dailyCheckinPresets.weekly[index]?.amount || '1000', '1000'),
                    label: dailyCheckinPresets.weekly[index]?.label || `Ngày ${day}`
                };
            });
        };

        const serializeDailyCheckinRows = (rows = []) => rows
            .slice(0, 7)
            .map((row, index) => {
                const day = String(index + 1);
                const amount = sanitizeMoneyText(row.amount, '0');
                const label = (row.label || '').trim() || `Ngày ${day}`;
                return `${day} | ${amount} | ${label}`;
            })
            .join('\n');

        const initLuckySpinBuilder = (form) => {
            const container = document.getElementById('lucky-spin-builder');
            const addRowBtn = document.getElementById('lucky-spin-add-row');
            const summary = document.getElementById('lucky-spin-summary');
            const sourceField = form?.lucky_spin_rewards_text;
            let rows = parseLuckySpinRows(sourceField?.value || '');

            const syncSource = () => {
                if (sourceField) {
                    sourceField.value = serializeLuckySpinRows(rows);
                }
                if (summary) {
                    const totalWeight = rows.reduce((sum, row) => sum + parseInt(sanitizeIntegerText(row.weight, '1', 1), 10), 0);
                    summary.textContent = `${rows.length} phần thưởng · Tổng tỷ lệ ${totalWeight}`;
                }
            };

            const render = () => {
                if (!container) return;
                container.innerHTML = rows.map((row, index) => `
                    <div class="config-builder-row" data-index="${index}">
                        <div class="config-builder-grid spin-builder-grid">
                            <div class="config-builder-field config-builder-field-grow">
                                <label>Tên thưởng</label>
                                <input type="text" data-field="label" value="${escapeBuilderValue(row.label)}" placeholder="VD: Thuong 2.000đ">
                            </div>
                            <div class="config-builder-field">
                                <label>Số tiền</label>
                                <input type="number" min="0" step="100" data-field="amount" value="${escapeBuilderValue(row.amount)}" placeholder="0">
                            </div>
                            <div class="config-builder-field">
                                <label>Tỷ lệ</label>
                                <input type="number" min="1" step="1" data-field="weight" value="${escapeBuilderValue(row.weight)}" placeholder="1">
                            </div>
                            <div class="config-builder-field">
                                <label>Màu</label>
                                <input type="color" data-field="color" value="${escapeBuilderValue(row.color || '#0ea5e9')}">
                            </div>
                        </div>
                        <div class="config-builder-row-actions">
                            <button type="button" class="btn-outline config-row-remove" data-index="${index}">Xóa</button>
                        </div>
                    </div>
                `).join('');
                syncSource();
            };

            container?.addEventListener('input', (event) => {
                const field = event.target?.getAttribute('data-field');
                const rowEl = event.target?.closest('.config-builder-row');
                const index = rowEl ? parseInt(rowEl.getAttribute('data-index') || '-1', 10) : -1;
                if (index < 0 || !field || !rows[index]) return;
                rows[index][field] = event.target.value;
                syncSource();
            });

            container?.addEventListener('click', (event) => {
                const removeBtn = event.target.closest('.config-row-remove');
                if (!removeBtn) return;
                const index = parseInt(removeBtn.getAttribute('data-index') || '-1', 10);
                if (index < 0) return;
                rows.splice(index, 1);
                if (!rows.length) {
                    rows = [{ label: '', amount: '0', weight: '1', color: '#0ea5e9' }];
                }
                render();
            });

            addRowBtn?.addEventListener('click', () => {
                rows.push({ label: '', amount: '0', weight: '1', color: '#0ea5e9' });
                render();
            });

            form?.querySelectorAll('.builder-preset-btn[data-builder-target="lucky-spin"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const presetKey = btn.getAttribute('data-builder-preset') || 'balanced';
                    rows = cloneRows(luckySpinPresets[presetKey] || luckySpinPresets.balanced);
                    render();
                });
            });

            return {
                setSource(raw = '') {
                    rows = parseLuckySpinRows(raw);
                    render();
                },
                syncSource
            };
        };

        const initDailyCheckinBuilder = (form) => {
            const container = document.getElementById('daily-checkin-builder');
            const summary = document.getElementById('daily-checkin-summary');
            const sourceField = form?.daily_checkin_rewards_text;
            let rows = parseDailyCheckinRows(sourceField?.value || '');

            const syncSource = () => {
                rows = rows.slice(0, 7).map((row, index) => ({
                    day: String(index + 1),
                    amount: sanitizeMoneyText(row.amount, '0'),
                    label: (row.label || '').trim()
                }));

                const normalizedRows = rows.map((row, index) => ({
                    day: String(index + 1),
                    amount: sanitizeMoneyText(row.amount, '0'),
                    label: (row.label || '').trim() || `Ngày ${index + 1}`
                }));

                if (sourceField) {
                    sourceField.value = serializeDailyCheckinRows(normalizedRows);
                }
                if (summary) {
                    const totalAmount = normalizedRows.reduce((sum, row) => sum + parseInt(sanitizeMoneyText(row.amount, '0'), 10), 0);
                    summary.textContent = `Chu kỳ cố định 7 ngày · Tổng chu kỳ ${formatMoney(totalAmount)}`;
                }
            };

            const render = () => {
                if (!container) return;
                container.innerHTML = rows.slice(0, 7).map((row, index) => `
                    <div class="config-builder-row">
                        <div class="config-builder-grid checkin-builder-grid-fixed">
                            <div class="config-builder-day">
                                <span>Ngày</span>
                                <strong>${index + 1}</strong>
                            </div>
                            <div class="config-builder-field">
                                <label>Số tiền</label>
                                <input type="number" min="0" step="100" data-index="${index}" data-field="amount" value="${escapeBuilderValue(row.amount)}" placeholder="1000">
                            </div>
                            <div class="config-builder-field config-builder-field-grow">
                                <label>Nhãn</label>
                                <input type="text" data-index="${index}" data-field="label" value="${escapeBuilderValue(row.label)}" placeholder="VD: Moc tuan">
                            </div>
                        </div>
                    </div>
                `).join('');
                syncSource();
            };

            container?.addEventListener('input', (event) => {
                const field = event.target?.getAttribute('data-field');
                const index = parseInt(event.target?.getAttribute('data-index') || '-1', 10);
                if (index < 0 || index > 6 || !field || !rows[index]) return;
                rows[index][field] = event.target.value;
                syncSource();
            });

            form?.querySelectorAll('.builder-preset-btn[data-builder-target="daily-checkin"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const presetKey = btn.getAttribute('data-builder-preset') || 'weekly';
                    rows = cloneRows(dailyCheckinPresets[presetKey] || dailyCheckinPresets.weekly).slice(0, 7).map((row, index) => ({
                        day: String(index + 1),
                        amount: sanitizeMoneyText(row.amount, '0'),
                        label: row.label || `Ngày ${index + 1}`
                    }));
                    render();
                });
            });

            return {
                setSource(raw = '') {
                    rows = parseDailyCheckinRows(raw);
                    render();
                },
                syncSource
            };
        };

        const accountMenuForm = document.getElementById('account-menu-setting-form');
        if (accountMenuForm) {
            const accountMenuKeys = ['account_menu_extra_links'];

            try {
                const res = await api.get('/settings', { keys: accountMenuKeys.join(',') });
                if (res.success) {
                    accountMenuKeys.forEach(key => {
                        if (accountMenuForm[key]) accountMenuForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            accountMenuForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const value = accountMenuForm.account_menu_extra_links
                    ? accountMenuForm.account_menu_extra_links.value
                    : '';

                await api.put('/admin/settings/account_menu_extra_links', { value });

                if (window.appInstance && typeof window.appInstance.loadAccountMenuConfig === 'function') {
                    await window.appInstance.loadAccountMenuConfig(true);
                    if (typeof window.appInstance.refreshRouteAwareUi === 'function') {
                        window.appInstance.refreshRouteAwareUi();
                    }
                }

                showToast('Đã cập nhật menu tài khoản', 'success');
            });
        }

        const luckySpinForm = document.getElementById('lucky-spin-setting-form');
        if (luckySpinForm) {
            const luckySpinBuilder = initLuckySpinBuilder(luckySpinForm);
            const luckySpinManualDayGroup = document.getElementById('lucky-spin-schedule-day-group');
            const luckySpinKeys = [
                'lucky_spin_enabled',
                'lucky_spin_title',
                'lucky_spin_subtitle',
                'lucky_spin_schedule_mode',
                'lucky_spin_manual_weekday',
                'lucky_spin_rewards_text'
            ];

            const syncLuckySpinScheduleMode = () => {
                const isManual = (luckySpinForm.lucky_spin_schedule_mode?.value || 'auto') === 'manual';
                if (luckySpinManualDayGroup) {
                    luckySpinManualDayGroup.style.opacity = isManual ? '1' : '0.7';
                }
                if (luckySpinForm.lucky_spin_manual_weekday) {
                    luckySpinForm.lucky_spin_manual_weekday.disabled = !isManual;
                }
            };

            try {
                const res = await api.get('/settings', { keys: luckySpinKeys.join(',') });
                if (res.success) {
                    if (luckySpinForm.lucky_spin_enabled) {
                        luckySpinForm.lucky_spin_enabled.checked = String(res.data.lucky_spin_enabled || '1') !== '0';
                    }
                    luckySpinKeys
                        .filter(key => key !== 'lucky_spin_enabled')
                        .forEach(key => {
                            if (luckySpinForm[key]) luckySpinForm[key].value = res.data[key] || '';
                        });
                    if (luckySpinForm.lucky_spin_schedule_mode && !luckySpinForm.lucky_spin_schedule_mode.value) {
                        luckySpinForm.lucky_spin_schedule_mode.value = 'auto';
                    }
                    if (luckySpinForm.lucky_spin_manual_weekday && !luckySpinForm.lucky_spin_manual_weekday.value) {
                        luckySpinForm.lucky_spin_manual_weekday.value = '6';
                    }
                    luckySpinBuilder.setSource(res.data.lucky_spin_rewards_text || '');
                    syncLuckySpinScheduleMode();
                }
            } catch (error) {
                // ignore
            }

            syncLuckySpinScheduleMode();
            luckySpinForm.lucky_spin_schedule_mode?.addEventListener('change', syncLuckySpinScheduleMode);

            luckySpinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                luckySpinBuilder.syncSource();
                await saveSettingEntries([
                    ['lucky_spin_enabled', luckySpinForm.lucky_spin_enabled && luckySpinForm.lucky_spin_enabled.checked ? '1' : '0'],
                    ['lucky_spin_title', luckySpinForm.lucky_spin_title ? luckySpinForm.lucky_spin_title.value.trim() : ''],
                    ['lucky_spin_subtitle', luckySpinForm.lucky_spin_subtitle ? luckySpinForm.lucky_spin_subtitle.value.trim() : ''],
                    ['lucky_spin_schedule_mode', luckySpinForm.lucky_spin_schedule_mode ? luckySpinForm.lucky_spin_schedule_mode.value : 'auto'],
                    ['lucky_spin_manual_weekday', luckySpinForm.lucky_spin_manual_weekday ? luckySpinForm.lucky_spin_manual_weekday.value : '6'],
                    ['lucky_spin_rewards_text', luckySpinForm.lucky_spin_rewards_text ? luckySpinForm.lucky_spin_rewards_text.value.trim() : '']
                ]);
                showToast('Đã cập nhật vòng quay may mắn', 'success');
            });
        }

        const dailyCheckinForm = document.getElementById('daily-checkin-setting-form');
        if (dailyCheckinForm) {
            const dailyCheckinBuilder = initDailyCheckinBuilder(dailyCheckinForm);
            const dailyCheckinKeys = [
                'daily_checkin_enabled',
                'daily_checkin_title',
                'daily_checkin_subtitle',
                'daily_checkin_rewards_text'
            ];

            try {
                const res = await api.get('/settings', { keys: dailyCheckinKeys.join(',') });
                if (res.success) {
                    if (dailyCheckinForm.daily_checkin_enabled) {
                        dailyCheckinForm.daily_checkin_enabled.checked = String(res.data.daily_checkin_enabled || '1') !== '0';
                    }
                    dailyCheckinKeys
                        .filter(key => key !== 'daily_checkin_enabled')
                        .forEach(key => {
                            if (dailyCheckinForm[key]) dailyCheckinForm[key].value = res.data[key] || '';
                        });
                    dailyCheckinBuilder.setSource(res.data.daily_checkin_rewards_text || '');
                }
            } catch (error) {
                // ignore
            }

            dailyCheckinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                dailyCheckinBuilder.syncSource();
                await saveSettingEntries([
                    ['daily_checkin_enabled', dailyCheckinForm.daily_checkin_enabled && dailyCheckinForm.daily_checkin_enabled.checked ? '1' : '0'],
                    ['daily_checkin_title', dailyCheckinForm.daily_checkin_title ? dailyCheckinForm.daily_checkin_title.value.trim() : ''],
                    ['daily_checkin_subtitle', dailyCheckinForm.daily_checkin_subtitle ? dailyCheckinForm.daily_checkin_subtitle.value.trim() : ''],
                    ['daily_checkin_rewards_text', dailyCheckinForm.daily_checkin_rewards_text ? dailyCheckinForm.daily_checkin_rewards_text.value.trim() : '']
                ]);
                showToast('Đã cập nhật điểm danh', 'success');
            });
        }

        const bankForm = document.getElementById('bank-setting-form');
        if (bankForm) {
            bankForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await api.put('/admin/settings/bank_name', { value: bankForm.bank_name.value.trim() });
                await api.put('/admin/settings/bank_account_number', { value: bankForm.bank_account_number.value.trim() });
                await api.put('/admin/settings/bank_account_name', { value: bankForm.bank_account_name.value.trim() });
                await api.put('/admin/settings/bank_qr_url', { value: bankForm.bank_qr_url.value.trim() });
                await api.put('/admin/settings/bank_note', { value: bankForm.bank_note.value.trim() });
                showToast('Đã cập nhật thông tin ngân hàng', 'success');
            });
        }

        const heroForm = document.getElementById('hero-setting-form');
        if (heroForm) {
            const heroKeys = [
                'hero_title',
                'hero_subtitle',
                'hero_btn_primary_text',
                'hero_btn_primary_link',
                'hero_btn_secondary_text',
                'hero_btn_secondary_link',
                'hero_card_title',
                'hero_card_subtitle',
                'hero_badges'
            ];
            const heroVersionKey = 'home_page_version';
            const versionField = heroForm.home_page_version;
            const v1Fields = document.getElementById('hero-v1-fields');
            const versionHint = document.getElementById('home-page-version-hint');
            const versionGroup = versionField ? versionField.closest('.form-group') : null;
            const versionLabel = versionGroup ? versionGroup.querySelector('label') : null;

            if (versionLabel) {
                versionLabel.textContent = 'Phien ban hien thi';
            }

            if (versionField && versionField.options.length >= 2) {
                versionField.options[0].textContent = 'V1 (mac dinh)';
                versionField.options[1].textContent = 'V2 (dung file v2.html)';
            }

            const syncHomeVersionEditorState = () => {
                const isV2 = versionField && versionField.value === 'v2';

                if (v1Fields) {
                    v1Fields.classList.toggle('is-disabled', isV2);
                    v1Fields.querySelectorAll('input, textarea, select').forEach(field => {
                        field.disabled = isV2;
                    });
                }

                if (versionHint) {
                    versionHint.innerHTML = isV2
                        ? 'V2 Đang bat. Noi dung lay truc tiep tu file <code>frontend/pages/v2.html</code>, muon sua V2 thi sua file nay.'
                        : 'V1 dang bat. Cac o ben duoi se ap dung cho giao dien trang chu mac dinh.';
                }
            };

            try {
                const res = await api.get('/settings', { keys: [heroVersionKey, ...heroKeys].join(',') });
                if (res.success) {
                    if (versionField) {
                        versionField.value = res.data[heroVersionKey] === 'v2' ? 'v2' : 'v1';
                    }
                    heroKeys.forEach(key => {
                        if (heroForm[key]) heroForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            syncHomeVersionEditorState();

            if (versionField) {
                versionField.addEventListener('change', syncHomeVersionEditorState);
            }

            heroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const homePageVersion = versionField && versionField.value === 'v2' ? 'v2' : 'v1';
                await api.put(`/admin/settings/${heroVersionKey}`, { value: homePageVersion });
                if (homePageVersion === 'v1') {
                    for (const key of heroKeys) {
                    const value = heroForm[key] ? heroForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                }
                showToast('Đã cập nhật nội dung trang chủ', 'success');
            });
        }

        const musicForm = document.getElementById('music-setting-form');
        if (musicForm) {
            const musicKeys = [
                'banner_v2_music_playlist',
                'banner_v2_music_order',
                'cloudinary_music_preset',
                'default_profile_music_url',
                'default_profile_music_title'
            ];
            const musicFileInput = document.getElementById('default-music-file');
            const musicFileLabel = document.getElementById('default-music-label');
            const musicPreview = document.getElementById('default-music-preview');
            const playlistField = musicForm.querySelector('[name="banner_v2_music_playlist"]');
            const musicOrderField = musicForm.querySelector('[name="banner_v2_music_order"]');
            let musicFiles = [];
            let uploadProgressMap = new Map();
            let isSavingMusic = false;

            const escapeHtml = (value = '') => String(value || '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char] || char));

            const cleanTrackTitle = (value = '') => value
                .replace(/\.[a-z0-9]{2,5}$/i, '')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const isYoutubeUrl = (value = '') => /(?:youtu\.be\/|youtube\.com\/)/i.test(String(value || '').trim());
            const detectMusicSourceType = (url = '') => isYoutubeUrl(url) ? 'youtube' : 'audio';
            const isMusicUploadFile = (file) => {
                if (!file) return false;
                return isAudioFile(file) || /^video\/mp4$/i.test(file.type || '') || /\.mp4$/i.test(file.name || '');
            };

            const deriveTrackTitle = (url = '', fallback = '') => {
                const fallbackTitle = cleanTrackTitle(fallback);
                if (fallbackTitle) return fallbackTitle;
                const raw = String(url || '').trim();
                if (!raw) return 'Nhạc nền';
                if (isYoutubeUrl(raw)) return 'YouTube';

                try {
                    const parsed = new URL(raw, window.location.origin);
                    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
                    const decodedSegment = decodeURIComponent(lastSegment || '');
                    return cleanTrackTitle(decodedSegment) || parsed.hostname || 'Nhạc nền';
                } catch (_) {
                    return cleanTrackTitle(raw) || 'Nhạc nền';
                }
            };

            const parseBannerMusicPlaylist = (raw = '') => raw
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map((line, index) => {
                    const separatorIndex = line.indexOf('|');
                    const titlePart = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : '';
                    const urlPart = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
                    if (!urlPart) return null;

                    return {
                        title: titlePart || deriveTrackTitle(urlPart, `Bài ${index + 1}`),
                        url: urlPart,
                        type: detectMusicSourceType(urlPart)
                    };
                })
                .filter(Boolean);

            const serializeBannerMusicPlaylist = (items = []) => items
                .filter(item => item && item.url)
                .map((item) => `${(item.title || deriveTrackTitle(item.url)).trim()} | ${String(item.url).trim()}`)
                .join('\n');

            try {
                const res = await api.get('/settings', { keys: musicKeys.join(',') });
                if (res.success) {
                    const savedPlaylist = parseBannerMusicPlaylist(res.data.banner_v2_music_playlist || '');
                    const legacyUrl = (res.data.default_profile_music_url || '').trim();
                    const legacyTitle = (res.data.default_profile_music_title || '').trim();
                    const resolvedPlaylist = savedPlaylist.length
                        ? savedPlaylist
                        : (legacyUrl ? [{
                            title: legacyTitle || deriveTrackTitle(legacyUrl),
                            url: legacyUrl,
                            type: detectMusicSourceType(legacyUrl)
                        }] : []);

                    if (playlistField) {
                        playlistField.value = serializeBannerMusicPlaylist(resolvedPlaylist);
                    }

                    if (musicOrderField) {
                        musicOrderField.value = res.data.banner_v2_music_order === 'shuffle' ? 'shuffle' : 'sequential';
                    }

                    if (musicForm.cloudinary_music_preset) {
                        musicForm.cloudinary_music_preset.value = res.data.cloudinary_music_preset || '';
                    }

                    renderDefaultMusicPreview();
                }
            } catch (_) {
                // ignore
            }

            if (musicFileInput) {
                musicFileInput.addEventListener('change', () => {
                    musicFiles = Array.from(musicFileInput.files || []);
                    uploadProgressMap = new Map();
                    setFileLabel(musicFileInput, musicFileLabel);
                    renderDefaultMusicPreview();
                });
            }

            if (playlistField) {
                playlistField.addEventListener('input', () => {
                    if (!isSavingMusic) {
                        renderDefaultMusicPreview();
                    }
                });
            }

            if (musicOrderField) {
                musicOrderField.addEventListener('change', () => {
                    renderDefaultMusicPreview();
                });
            }

            musicForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (isSavingMusic) return;
                isSavingMusic = true;
                try {
                    const preset = (musicForm.cloudinary_music_preset.value || 'audio_upload').trim();
                    const playMode = musicOrderField && musicOrderField.value === 'shuffle' ? 'shuffle' : 'sequential';
                    const playlistItems = parseBannerMusicPlaylist(playlistField ? playlistField.value : '');

                    if (musicFiles.length) {
                        for (let index = 0; index < musicFiles.length; index += 1) {
                            const musicFile = musicFiles[index];
                            if (!isMusicUploadFile(musicFile)) {
                                throw new Error(`File ${musicFile.name} không hợp lệ`);
                            }

                            uploadProgressMap.set(index, 0);
                            renderDefaultMusicPreview();

                            const uploadResult = await uploadToCloudinary(musicFile, {
                                uploadPreset: preset,
                                onProgress: (percent) => {
                                    uploadProgressMap.set(index, percent);
                                    renderDefaultMusicPreview();
                                }
                            });

                            playlistItems.push({
                                title: deriveTrackTitle('', musicFile.name || `Bài ${playlistItems.length + 1}`),
                                url: uploadResult.url,
                                type: 'audio'
                            });

                            if (playlistField) {
                                playlistField.value = serializeBannerMusicPlaylist(playlistItems);
                            }

                            uploadProgressMap.set(index, 100);
                            renderDefaultMusicPreview();
                        }
                    }

                    const serializedPlaylist = serializeBannerMusicPlaylist(playlistItems);
                    const firstAudioTrack = playlistItems.find(item => item.type === 'audio');

                    await api.put('/admin/settings/banner_v2_music_playlist', { value: serializedPlaylist });
                    await api.put('/admin/settings/banner_v2_music_order', { value: playMode });
                    await api.put('/admin/settings/cloudinary_music_preset', { value: preset });
                    await api.put('/admin/settings/default_profile_music_url', { value: firstAudioTrack ? firstAudioTrack.url : '' });
                    await api.put('/admin/settings/default_profile_music_title', { value: firstAudioTrack ? firstAudioTrack.title : '' });

                    showToast('Đã lưu nhạc nền Banner V2', 'success');
                    musicFiles = [];
                    uploadProgressMap = new Map();
                    if (musicFileInput) musicFileInput.value = '';
                    setFileLabel(musicFileInput, musicFileLabel);
                    renderDefaultMusicPreview();
                } catch (error) {
                    showToast(error.message || 'Không thể lưu nhạc nền Banner V2', 'error');
                } finally {
                    isSavingMusic = false;
                }
            });

            function renderDefaultMusicPreview() {
                if (!musicPreview) return;
                const playlistItems = parseBannerMusicPlaylist(playlistField ? playlistField.value : '');
                const pendingUploads = musicFiles.map((file, index) => ({
                    file,
                    progress: uploadProgressMap.has(index) ? uploadProgressMap.get(index) : 0
                }));
                const modeLabel = musicOrderField && musicOrderField.value === 'shuffle' ? 'Ngẫu nhiên' : 'Theo thứ tự';

                if (!playlistItems.length && !pendingUploads.length) {
                    musicPreview.innerHTML = '<p class="upload-empty">Chưa có nhạc nào cho Banner V2.</p>';
                    return;
                }

                musicPreview.innerHTML = `
                    <div class="upload-preview-item">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                            <strong>Playlist Banner V2</strong>
                            <span style="display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:999px;background:rgba(14,165,164,0.12);color:var(--primary-strong);font-size:12px;font-weight:700;">${escapeHtml(modeLabel)}</span>
                        </div>
                        <div style="margin-top:8px;font-size:12px;color:var(--muted);">
                            ${playlistItems.length} bài đã lưu${pendingUploads.length ? ` · ${pendingUploads.length} file chờ upload` : ''}
                        </div>
                    </div>
                    ${playlistItems.map((item, index) => `
                        <div class="upload-preview-item">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
                                <strong>${escapeHtml(item.title || `Bài ${index + 1}`)}</strong>
                                <span style="display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:999px;background:${item.type === 'youtube' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'};color:${item.type === 'youtube' ? '#b91c1c' : '#1d4ed8'};font-size:12px;font-weight:700;">${item.type === 'youtube' ? 'YouTube' : 'Audio'}</span>
                            </div>
                            ${item.type === 'youtube'
                                ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn-outline btn-small">Mở link YouTube</a>`
                                : `<audio controls src="${escapeHtml(item.url)}" preload="metadata"></audio>`
                            }
                            <div style="margin-top:8px;font-size:12px;color:var(--muted);word-break:break-all;">${escapeHtml(item.url)}</div>
                        </div>
                    `).join('')}
                    ${pendingUploads.map(({ file, progress }, index) => `
                        <div class="upload-preview-item">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                <strong>${escapeHtml(deriveTrackTitle('', file.name || `File ${index + 1}`))}</strong>
                                <span style="display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:999px;background:rgba(249,115,22,0.12);color:#c2410c;font-size:12px;font-weight:700;">${progress > 0 ? 'Đang upload' : 'Chờ upload'}</span>
                            </div>
                            <div class="upload-progress">
                                <div class="upload-progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div>
                            </div>
                            <div class="upload-progress-text">${Math.max(0, Math.min(100, progress))}%</div>
                            <div style="margin-top:8px;font-size:12px;color:var(--muted);word-break:break-all;">${escapeHtml(file.name || '')}</div>
                        </div>
                    `).join('')}
                `;
            }
        }

        const frameForm = document.getElementById('frame-setting-form');
        if (frameForm) {
            const frameFileInput = document.getElementById('admin-frame-file');
            const frameFileLabel = document.getElementById('admin-frame-file-label');
            const framePreview = document.getElementById('admin-frame-preview');
            const frameList = document.getElementById('admin-frame-list');
            let frameFile = null;
            let framePreviewUrl = '';

            const clearFramePreviewUrl = () => {
                if (framePreviewUrl) {
                    URL.revokeObjectURL(framePreviewUrl);
                    framePreviewUrl = '';
                }
            };

            const renderFramePreview = (file = null) => {
                if (!framePreview) return;
                clearFramePreviewUrl();

                if (!(file instanceof File)) {
                    framePreview.innerHTML = '<p class="upload-empty">Chua chon khung avatar.</p>';
                    return;
                }

                framePreviewUrl = URL.createObjectURL(file);
                framePreview.innerHTML = `
                    <div class="upload-preview-item admin-frame-upload-preview">
                        <img src="${framePreviewUrl}" class="upload-preview-img" alt="frame preview">
                    </div>
                `;
            };

            const loadAdminFrames = async () => {
                if (!frameList) return;
                try {
                    const res = await api.get('/admin/frames');
                    if (!res.success) {
                        frameList.innerHTML = '<p>Khong the tai danh sach khung.</p>';
                        return;
                    }

                    const items = res.data || [];
                    if (!items.length) {
                        frameList.innerHTML = '<p class="upload-empty">Chua co khung mau.</p>';
                        return;
                    }

                    frameList.innerHTML = `
                        <div class="section-header">
                            <h3 class="section-title">Khung hien co</h3>
                        </div>
                        <div class="admin-frame-grid">
                            ${items.map(item => `
                                <div class="admin-frame-card">
                                    <img src="${item.url}" alt="${item.name}" class="admin-frame-card-image">
                                    <div class="admin-frame-meta">
                                        <div>${item.name}</div>
                                        <span style="display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:999px;background:${item.deletable ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)'};color:${item.deletable ? '#15803d' : '#1d4ed8'};font-size:12px;font-weight:700;">
                                            ${item.deletable ? 'Khung admin' : 'Khung goc'}
                                        </span>
                                    </div>
                                    ${item.deletable
                                        ? `<button type="button" class="btn-ghost btn-danger admin-frame-remove" data-frame-delete="${item.name}">Xoa</button>`
                                        : '<button type="button" class="btn-ghost btn-danger" disabled style="opacity:.45;cursor:not-allowed;">Khung goc</button>'
                                    }
                                </div>
                            `).join('')}
                        </div>
                    `;

                    frameList.querySelectorAll('button[data-frame-delete]').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Xoa khung nay?')) return;
                            try {
                                const result = await api.delete(`/admin/frames/${encodeURIComponent(btn.dataset.frameDelete || '')}`);
                                if (result.success) {
                                    showToast('Da xoa khung avatar', 'success');
                                    await loadAdminFrames();
                                }
                            } catch (error) {
                                showToast(error.message || 'Khong the xoa khung', 'error');
                            }
                        });
                    });
                } catch (error) {
                    frameList.innerHTML = '<p>Khong the tai danh sach khung.</p>';
                }
            };

            if (frameFileInput) {
                frameFileInput.addEventListener('change', () => {
                    frameFile = frameFileInput.files && frameFileInput.files[0] ? frameFileInput.files[0] : null;
                    setFileLabel(frameFileInput, frameFileLabel);
                    renderFramePreview(frameFile);
                });
            }

            frameForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!frameFile) {
                    showToast('Vui long chon khung avatar', 'warning');
                    return;
                }

                try {
                    const fd = new FormData();
                    fd.append('file', frameFile);
                    const result = await api.upload('/admin/frames', fd);
                    if (result.success) {
                        showToast('Da tai khung avatar len', 'success');
                        frameFile = null;
                        if (frameFileInput) frameFileInput.value = '';
                        setFileLabel(frameFileInput, frameFileLabel);
                        renderFramePreview(null);
                        await loadAdminFrames();
                        return;
                    }
                    showToast(result.message || 'Khong the tai khung len', 'error');
                } catch (error) {
                    showToast(error.message || 'Khong the tai khung len', 'error');
                }
            });

            renderFramePreview(null);
            loadAdminFrames();
        }

        const tosForm = document.getElementById('tos-setting-form');
        if (tosForm) {
            const tosKeys = ['tos_title', 'tos_content'];
            try {
                const res = await api.get('/settings', { keys: tosKeys.join(',') });
                if (res.success) {
                    tosKeys.forEach(key => {
                        if (tosForm[key]) tosForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            tosForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of tosKeys) {
                    const value = tosForm[key] ? tosForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật điều khoản', 'success');
            });
        }

        const aiConfigForm = document.getElementById('ai-config-form');
        const aiApiKeyStatus = document.getElementById('ai-api-key-status');
        if (aiConfigForm) {
            try {
                const res = await api.get('/admin/ai-config');
                if (res.success) {
                    const data = res.data || {};
                    aiConfigForm.ai_name.value = data.ai_name || '';
                    aiConfigForm.ai_personality.value = data.ai_personality || '';
                    aiConfigForm.ai_knowledge.value = data.ai_knowledge || '';
                    aiConfigForm.ai_system_prompt.value = data.ai_system_prompt || '';
                    if (aiApiKeyStatus) {
                        aiApiKeyStatus.textContent = data.has_ai_api_key
                            ? `Đã có API key (${data.ai_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                }
            } catch (error) {
                if (aiApiKeyStatus) aiApiKeyStatus.textContent = 'Không thể tải cấu hình AI.';
            }

            aiConfigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const payload = {
                        ai_name: aiConfigForm.ai_name.value.trim(),
                        ai_personality: aiConfigForm.ai_personality.value.trim(),
                        ai_knowledge: aiConfigForm.ai_knowledge.value.trim(),
                        ai_system_prompt: aiConfigForm.ai_system_prompt.value.trim(),
                        ai_api_key: aiConfigForm.ai_api_key.value.trim(),
                        clear_ai_api_key: !!aiConfigForm.clear_ai_api_key.checked
                    };
                    await api.put('/admin/ai-config', payload);
                    aiConfigForm.ai_api_key.value = '';
                    aiConfigForm.clear_ai_api_key.checked = false;
                    showToast('Đã lưu cấu hình AI', 'success');

                    const refreshed = await api.get('/admin/ai-config');
                    if (refreshed.success && aiApiKeyStatus) {
                        const data = refreshed.data || {};
                        aiApiKeyStatus.textContent = data.has_ai_api_key
                            ? `Đã có API key (${data.ai_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể lưu cấu hình AI', 'error');
                }
            });
        }

        const privateBotForm = document.getElementById('private-bot-config-form');
        const privateBotApiKeyStatus = document.getElementById('private-bot-api-key-status');
        const privateBotSnippet = document.getElementById('private-bot-snippet');
        const copyPrivateBotEnvBtn = document.getElementById('copy-private-bot-env');
        const copyPrivateBotPythonBtn = document.getElementById('copy-private-bot-python');

        const buildPrivateBotConfigSnippet = (form) => {
            const apiUrl = form?.private_bot_api_url?.value?.trim() || '';
            const botName = form?.private_bot_name?.value?.trim() || 'Sang Internal Bot';
            const allowedIds = form?.private_bot_allowed_chat_ids?.value?.trim() || '';
            const enabled = !!form?.private_bot_enabled?.checked;
            const apiKeyStatus = privateBotApiKeyStatus?.textContent || '';
            return [
                '# .env',
                `PRIVATE_BOT_ENABLED=${enabled ? '1' : '0'}`,
                `PRIVATE_BOT_NAME=${botName}`,
                `PRIVATE_BOT_API_URL=${apiUrl || 'http://127.0.0.1:3001/api/private-bot'}`,
                `PRIVATE_BOT_ALLOWED_CHAT_IDS=${allowedIds || '123456789'}`,
                `PRIVATE_BOT_API_KEY=${apiKeyStatus.includes('Đã có API key') ? '<da-luu-trong-admin>' : '<nhap-key-o-day>'}`,
                '',
                '# Python bootstrap',
                'import os',
                '',
                'PRIVATE_BOT_API_URL = os.getenv("PRIVATE_BOT_API_URL", "").strip()',
                'PRIVATE_BOT_API_KEY = os.getenv("PRIVATE_BOT_API_KEY", "").strip()',
                'PRIVATE_BOT_ALLOWED_CHAT_IDS = [',
                '    chat_id.strip()',
                '    for chat_id in os.getenv("PRIVATE_BOT_ALLOWED_CHAT_IDS", "").split(",")',
                '    if chat_id.strip()',
                ']',
                '',
                'def is_allowed(chat_id: int) -> bool:',
                '    return str(chat_id) in PRIVATE_BOT_ALLOWED_CHAT_IDS',
                '',
                'print("Bot nội bộ sẵn sàng")'
            ].join('\n');
        };

        const refreshPrivateBotSnippet = () => {
            if (!privateBotSnippet || !privateBotForm) return;
            privateBotSnippet.textContent = buildPrivateBotConfigSnippet(privateBotForm);
        };

        if (privateBotForm) {
            try {
                const res = await api.get('/admin/private-bot-config');
                if (res.success) {
                    const data = res.data || {};
                    privateBotForm.private_bot_name.value = data.private_bot_name || '';
                    privateBotForm.private_bot_api_url.value = data.private_bot_api_url || '';
                    privateBotForm.private_bot_allowed_chat_ids.value = data.private_bot_allowed_chat_ids || '';
                    privateBotForm.private_bot_enabled.checked = !!data.private_bot_enabled;
                    if (privateBotApiKeyStatus) {
                        privateBotApiKeyStatus.textContent = data.has_private_bot_api_key
                            ? `Đã có API key (${data.private_bot_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                    refreshPrivateBotSnippet();
                }
            } catch (error) {
                if (privateBotApiKeyStatus) privateBotApiKeyStatus.textContent = 'Không thể tải cấu hình bot nội bộ.';
            }

            privateBotForm.addEventListener('input', refreshPrivateBotSnippet);
            privateBotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const payload = {
                        private_bot_name: privateBotForm.private_bot_name.value.trim(),
                        private_bot_api_url: privateBotForm.private_bot_api_url.value.trim(),
                        private_bot_allowed_chat_ids: privateBotForm.private_bot_allowed_chat_ids.value.trim(),
                        private_bot_enabled: !!privateBotForm.private_bot_enabled.checked,
                        private_bot_api_key: privateBotForm.private_bot_api_key.value.trim(),
                        clear_private_bot_api_key: !!privateBotForm.clear_private_bot_api_key.checked
                    };
                    await api.put('/admin/private-bot-config', payload);
                    privateBotForm.private_bot_api_key.value = '';
                    privateBotForm.clear_private_bot_api_key.checked = false;
                    showToast('Đã lưu cấu hình bot nội bộ', 'success');

                    const refreshed = await api.get('/admin/private-bot-config');
                    if (refreshed.success && privateBotApiKeyStatus) {
                        const data = refreshed.data || {};
                        privateBotApiKeyStatus.textContent = data.has_private_bot_api_key
                            ? `Đã có API key (${data.private_bot_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                    refreshPrivateBotSnippet();
                } catch (error) {
                    showToast(error.message || 'Không thể lưu cấu hình bot nội bộ', 'error');
                }
            });
        }

        if (copyPrivateBotEnvBtn) {
            copyPrivateBotEnvBtn.addEventListener('click', () => {
                if (privateBotSnippet) copyToClipboard(privateBotSnippet.textContent || '');
                showToast('Đã copy mẫu .env', 'success');
            });
        }

        if (copyPrivateBotPythonBtn) {
            copyPrivateBotPythonBtn.addEventListener('click', () => {
                if (privateBotSnippet) copyToClipboard(privateBotSnippet.textContent || '');
                showToast('Đã copy mẫu Python', 'success');
            });
        }

        container.querySelectorAll('.settings-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.settings-section');
                if (!section) return;
                container.querySelectorAll('.settings-section').forEach(s => {
                    if (s !== section) s.classList.remove('active');
                });
                section.classList.toggle('active');
            });
        });

        const apiKeyForm = document.getElementById('api-key-form');
        const apiKeyResult = document.getElementById('api-key-result');
        const apiKeyList = document.getElementById('api-key-list');

        async function loadApiKeys() {
            try {
                const res = await api.get('/admin/api-keys');
                if (!res.success) return;
                const items = res.data || [];
                apiKeyList.innerHTML = items.length ? `
                    <div class="section-header">
                        <h3 class="section-title">Danh sách API key</h3>
                    </div>
                    <div class="notif-cards">
                        ${items.map(k => `
                            <div class="notif-card">
                                <div class="notif-card-header">
                                    <div>
                                        <div class="notif-card-title">${k.name}</div>
                                        <div class="notif-card-meta">Tạo: ${formatDateShort(k.created_at)}</div>
                                    </div>
                                    <div class="badge ${k.revoked_at ? 'badge-danger' : 'badge-success'}">
                                        ${k.revoked_at ? 'Đã thu hồi' : 'Đang hoạt động'}
                                    </div>
                                </div>
                                ${k.revoked_at ? '' : `<button class="btn-danger" data-revoke-key="${k.id}">Thu hồi</button>`}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>Chưa có API key.</p>';

                apiKeyList.querySelectorAll('button[data-revoke-key]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Thu hồi API key này?')) return;
                        await api.delete(`/admin/api-keys/${btn.dataset.revokeKey}`);
                        await loadApiKeys();
                    });
                });
            } catch (error) {
                apiKeyList.innerHTML = '<p>Không thể tải API key.</p>';
            }
        }

        if (apiKeyForm) {
            apiKeyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = apiKeyForm.name.value.trim();
                if (!name) return;
                const res = await api.post('/admin/api-keys', { name });
                if (res.success) {
                    apiKeyResult.style.display = 'block';
                    apiKeyResult.innerHTML = `
                        <div class="section-header">
                            <div>
                                <h3 class="section-title">API key mới</h3>
                                <p class="section-subtitle">Chỉ hiển thị một lần, hãy copy và lưu lại.</p>
                            </div>
                            <button id="copy-api-key" class="btn-outline">Copy</button>
                        </div>
                        <div class="stat-card" style="word-break: break-all;">${res.data.key}</div>
                    `;
                    document.getElementById('copy-api-key').addEventListener('click', () => {
                        copyToClipboard(res.data.key);
                    });
                    apiKeyForm.reset();
                    await loadApiKeys();
                }
            });
        }

        await loadApiKeys();
    }

    function renderDonutChart(container, percent = 0, options = {}) {
        if (!container) return;
        const size = options.size || 120;
        const radius = size / 2 - 10;
        const circumference = 2 * Math.PI * radius;
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        const progress = (clamped / 100) * circumference;
        const gradientId = `donut-grad-${Math.random().toString(36).slice(2, 8)}`;

        container.innerHTML = `
            <svg viewBox="0 0 ${size} ${size}" class="donut-svg">
                <defs>
                    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="${options.from || '#14b8a6'}" />
                        <stop offset="100%" stop-color="${options.to || '#f97316'}" />
                    </linearGradient>
                </defs>
                <circle class="donut-track" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="10"></circle>
                <circle
                    class="donut-value"
                    cx="${size / 2}"
                    cy="${size / 2}"
                    r="${radius}"
                    stroke-width="10"
                    stroke="url(#${gradientId})"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${circumference - progress}"
                    transform="rotate(-90 ${size / 2} ${size / 2})"
                ></circle>
                <text class="donut-percent" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">${clamped}%</text>
            </svg>
        `;
    }

    function renderComboChart(container, series = [], options = {}) {
        if (!container) return;
        if (!series.length) {
            container.innerHTML = '<p class="chart-empty">Chưa có dữ liệu.</p>';
            return;
        }
        const maxPoints = options.maxPoints || series.length;
        const data = series.slice(-maxPoints);
        const maxValue = Math.max(...data.map(item => item.value || 0), 1);
        const width = Math.max(280, data.length * 22);
        const height = 180;
        const padding = 22;

        const scaleX = (i) => padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2);
        const scaleY = (v) => padding + (1 - (v / maxValue)) * (height - padding * 2);

        // Smooth line using simple moving average (window=3)
        const smooth = data.map((d, i) => {
            const prev = data[i - 1]?.value || d.value || 0;
            const next = data[i + 1]?.value || d.value || 0;
            return (prev + (d.value || 0) + next) / 3;
        });

        const barWidth = Math.max(10, (width - padding * 2) / Math.max(4, data.length) - 4);

        const bars = data.map((d, i) => {
            const x = scaleX(i) - barWidth / 2;
            const y = scaleY(d.value || 0);
            const h = height - padding - y;
            const label = options.labelFormat === 'month'
                ? d.label
                : (d.label?.slice(5) || d.label || '');
            return `
                <g class="combo-bar">
                    <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4"></rect>
                    <text x="${x + barWidth / 2}" y="${height - padding + 14}" class="bar-label">${label}</text>
                </g>
            `;
        }).join('');

        const linePoints = data.map((d, i) => `${scaleX(i)},${scaleY(smooth[i] || 0)}`).join(' ');

        const dots = data.map((d, i) => {
            const x = scaleX(i);
            const y = scaleY(smooth[i] || 0);
            return `
                <g class="dot-group" transform="translate(${x},${y})">
                    <circle r="4"></circle>
                    <title>${d.label}: ${formatMoney(d.value || 0)}</title>
                </g>
            `;
        }).join('');

        container.innerHTML = `
            <div class="combo-legend">
                <span class="legend-item legend-bar">Doanh thu</span>
                <span class="legend-item legend-line">Xu hướng</span>
            </div>
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#f97316" />
                        <stop offset="100%" stop-color="#ea580c" />
                    </linearGradient>
                    <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#7c3aed" />
                        <stop offset="100%" stop-color="#6366f1" />
                    </linearGradient>
                </defs>
                ${bars}
                <polyline class="combo-line" points="${linePoints}" />
                ${dots}
            </svg>
        `;
    }

    function formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
        const num = value / Math.pow(1024, idx);
        return `${num.toFixed(num >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function initShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const closeBtn = document.getElementById('share-data-close');
        const copyBtn = document.getElementById('share-copy-json');
        const output = document.getElementById('share-json-output');

        if (!modal) return;

        const closeModal = () => {
            modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });

        if (copyBtn && output) {
            copyBtn.addEventListener('click', () => {
                if (!output.value) return;
                copyToClipboard(output.value);
            });
        }
    }

    async function openShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const listEl = document.getElementById('share-data-list');
        const output = document.getElementById('share-json-output');

        if (!modal || !listEl) return;
        modal.classList.add('active');
        listEl.innerHTML = '<p>Đang tải danh mục...</p>';
        if (output) output.value = '';

        try {
            const res = await api.get('/admin/share/categories');
            if (!res.success) {
                listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
                return;
            }

            const items = res.data || [];
            if (!items.length) {
                listEl.innerHTML = '<p>Chưa có danh mục để chia sẻ.</p>';
                return;
            }

            listEl.innerHTML = items.map(item => `
                <div class="share-data-item">
                    <div class="section-title">${item.label}</div>
                    <div class="section-subtitle">${item.description || ''}</div>
                    <div class="badge badge-info">Số lượng: ${item.count || 0}</div>
                    <button class="btn-outline" data-share-key="${item.key}">Xem JSON</button>
                </div>
            `).join('');

            listEl.querySelectorAll('[data-share-key]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const key = btn.dataset.shareKey;
                    if (!key) return;
                    btn.disabled = true;
                    btn.textContent = 'Đang tải...';
                    try {
                        const dataRes = await api.get(`/admin/share/data/${key}`);
                        if (dataRes.success && output) {
                            output.value = JSON.stringify(dataRes.data, null, 2);
                            showToast('Đã tải JSON', 'success');
                        } else {
                            showToast('Không thể tải JSON', 'error');
                        }
                    } catch (error) {
                        showToast(error.message || 'Không thể tải JSON', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Xem JSON';
                    }
                });
            });
        } catch (error) {
            listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
        }
    }
};




