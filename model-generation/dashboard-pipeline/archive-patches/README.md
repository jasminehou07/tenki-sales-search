# Archived one-off server patches

These scripts preserve historical edits applied directly to the deployed Node
API during dashboard development. They are **not** part of model generation,
database loading, normal deployment, or disaster recovery.

Most patch files assume a specific `/opt/tenki-dashboard/api/server.js` version
and perform text replacement. Running them against a different version may
corrupt or partially modify the API. Keep them only as implementation history;
make reviewed source changes in the actual API repository instead.
