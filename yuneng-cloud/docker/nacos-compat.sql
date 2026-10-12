-- Nacos 2.0.3 does not populate the encryption column in newer SQL exports.
ALTER TABLE config_info MODIFY COLUMN encrypted_data_key TEXT NOT NULL DEFAULT ('');
ALTER TABLE config_info_beta MODIFY COLUMN encrypted_data_key TEXT NOT NULL DEFAULT ('');
ALTER TABLE his_config_info MODIFY COLUMN encrypted_data_key TEXT NOT NULL DEFAULT ('');
