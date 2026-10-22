<?php
// Minimal PSR-4 autoloader for bundled dompdf 3.0.0 and its dependencies.
spl_autoload_register(function ($class) {
	static $map = null;
	if ($map === null) {
		$b = __DIR__;
		$map = array(
			'Dompdf\\'           => $b . '/dompdf/src/',
			'FontLib\\'          => $b . '/php-font-lib/src/FontLib/',
			'Svg\\'              => $b . '/php-svg-lib/src/Svg/',
			'Masterminds\\'      => $b . '/html5/src/',
			'Sabberworm\\CSS\\'  => $b . '/php-css-parser/src/',
		);
	}
	if ($class === 'Dompdf\\Cpdf') { require_once __DIR__ . '/dompdf/lib/Cpdf.php'; return; }
	foreach ($map as $prefix => $dir) {
		if (strncmp($class, $prefix, strlen($prefix)) === 0) {
			$file = $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
			if (is_file($file)) { require_once $file; }
			return;
		}
	}
});
