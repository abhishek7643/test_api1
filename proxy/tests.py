from django.test import TestCase
from proxy.services import (
    SSRFProtectionError,
    execute_request,
    is_ssrf_safe_ip,
    validate_target_url,
)


class SSRFProtectionTests(TestCase):
    def test_blocks_cloud_metadata(self):
        with self.assertRaises(SSRFProtectionError):
            validate_target_url('http://169.254.169.254/latest/meta-data/')
        with self.assertRaises(SSRFProtectionError):
            validate_target_url('http://metadata.google.internal/computeMetadata/v1/')

    def test_blocks_private_ips(self):
        with self.assertRaises(SSRFProtectionError):
            validate_target_url('http://10.0.0.1/admin')
        with self.assertRaises(SSRFProtectionError):
            validate_target_url('http://192.168.1.1/secret')
        with self.assertRaises(SSRFProtectionError):
            validate_target_url('http://172.16.0.1/internal')

    def test_blocks_invalid_schemes(self):
        with self.assertRaises(ValueError):
            validate_target_url('ftp://example.com/file')
        with self.assertRaises(ValueError):
            validate_target_url('file:///etc/passwd')

    def test_allows_public_urls(self):
        self.assertTrue(validate_target_url('https://httpbin.org/get'))
        self.assertTrue(validate_target_url('https://api.github.com/zen'))

    def test_is_ssrf_safe_ip_detection(self):
        self.assertFalse(is_ssrf_safe_ip('127.0.0.1'))
        self.assertFalse(is_ssrf_safe_ip('10.200.1.5'))
        self.assertFalse(is_ssrf_safe_ip('192.168.0.1'))
        self.assertFalse(is_ssrf_safe_ip('172.16.5.5'))
        self.assertFalse(is_ssrf_safe_ip('169.254.169.254'))
        self.assertTrue(is_ssrf_safe_ip('8.8.8.8'))
        self.assertTrue(is_ssrf_safe_ip('1.1.1.1'))
