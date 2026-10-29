### Quản lý branch
- Main branch pattern: `<account>`_`<env>`
  Exam:  linhpd16_sandbox

- Sub branch pattern: `<account>`_`<env>`_`<feature / customer>`
  Exam:  linhpd16_sandbox_ekntc

### Commit message
- `(*)` Prefix: create / update / fix / refactor
- `(*)` Scope / Feature / Customer
- `(*)` Suffix: description

- Pattern: `<Prefix>`_`<Scope / Feature / Customer>`_`<Suffix>`
  Exam: update_ekntc_change form start QT1 , update_view document interface_upgrade add view digital signature

### Cấu trúc thư mục
Mọi tài nguyên nằm dưới `workspace/<customer>/<env>/<phân hệ>/`, được kéo về / đẩy lên bằng CLI `kyta`.

```text
workspace/
  registry.json                                  # bảng tra formId → customer/env/path (sinh tự động, không sửa tay)
  <customer>/<env>/
    eform/<nhóm>/<tên form>/                     # .meta.json, code/*.js, ui/<field>/, fields.json
    eflow/<tên quy trình>/                       # .meta.json, flow.json
    email/<tên mẫu>/                             # .meta.json, content.html
    ewriter/<tên bản in>/                        # .meta.json, template.docx, variables.json...
    ecatalog/<tên danh mục>/                     # .meta.json, data.json...
    lib/<TÊN>.js                                 # khối code dùng chung giữa các form
    excall/<excall|excall-internal>/<selector>/  # script.groovy, .meta.json, samples/
```

- `<env>`: `dev` / `sandbox` / `uat` / `prod` / `demo`.
  Exam: workspace/sabeco/uat/eform/Quy trình giao nhận vật phẩm quảng cáo/Form biên bản giao nhận VPQC/
- Selector excall không có quy trình deploy: code tại `script.groovy` rồi dán lên selector trên server; `.meta.json` ghi cấu hình selector (async, callback, recallType...).